"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { FN_NAME, judge, MAX_CODE_LENGTH, parseTests, type JudgeReport, type TestCase } from "@/lib/judge";
import { createAdminClient } from "@/lib/supabase/admin";

const path = (id: string) => `/defis/${id}`;

export async function createChallenge(formData: FormData) {
  const { supabase, user } = await requireSession("/defis/new");
  const fail = (message: string): never => redirect(`/defis/new?error=${encodeURIComponent(message)}`);
  const days = Number(formData.get("days")) || 7;
  const grading = formData.get("grading") === "auto" ? "auto" : "jury";

  let tests: TestCase[] = [];
  let functionName: string | null = null;
  let starter: string | null = null;
  if (grading === "auto") {
    functionName = String(formData.get("function_name") ?? "").trim();
    if (!FN_NAME.test(functionName)) fail("Nom de fonction invalide (lettres, chiffres, _ ou $).");
    starter = String(formData.get("starter_code") ?? "").trim() || null;
    try {
      tests = parseTests(String(formData.get("tests") ?? ""));
    } catch (e) {
      fail((e as Error).message);
    }
    // La solution de référence (non conservée) doit réussir 100 % des tests : on évite ainsi un défi faux.
    const reference = String(formData.get("reference_code") ?? "");
    if (reference.trim()) {
      const check = await judge(reference, functionName!, tests);
      if (check.error) fail(`Solution de référence : ${check.error}`);
      if (check.passed !== check.total) {
        const ko = check.results.filter((r) => !r.pass).map((r) => r.index).join(", ");
        fail(`La solution de référence échoue aux tests ${ko}. Corrige les tests avant de publier.`);
      }
    }
  }

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      title: String(formData.get("title")).trim(),
      description: String(formData.get("description")).trim(),
      kind: String(formData.get("kind")),
      grading,
      function_name: functionName,
      starter_code: starter,
      sponsor_name: String(formData.get("sponsor_name") || "") || null,
      sponsor_url: String(formData.get("sponsor_url") || "") || null,
      ends_at: new Date(Date.now() + days * 86400000).toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) fail(error.message);
  if (tests.length) {
    const { error: eTests } = await supabase
      .from("challenge_tests")
      .insert(tests.map((t, i) => ({ challenge_id: data!.id, position: i + 1, args: t.args, expected: t.expected, is_public: t.is_public })));
    if (eTests) {
      await supabase.from("challenges").delete().eq("id", data!.id);
      fail(eTests.message);
    }
  }
  redirect(path(data!.id));
}

export type AutoState = { report?: JudgeReport; mode?: "test" | "submit"; message?: string; error?: string; code?: string };

const COOLDOWN_MS = 10_000;
const MAX_ATTEMPTS = 50;

// Correction automatique : « test » = exemples publics seulement, rien n'est enregistré ;
// « submit » = tous les tests, le meilleur score est conservé (départage : premier à l'atteindre).
export async function submitAutoSolution(challengeId: string, _prev: AutoState, formData: FormData): Promise<AutoState> {
  const { user } = await requireSession(path(challengeId));
  const admin = createAdminClient();
  const code = String(formData.get("code") ?? "");
  const mode = formData.get("mode") === "submit" ? "submit" : "test";
  if (code.length > MAX_CODE_LENGTH) return { error: `Code trop long (${MAX_CODE_LENGTH} caractères max.)`, code };

  const { data: challenge } = await admin
    .from("challenges")
    .select("grading, function_name, starts_at, ends_at, closed_at")
    .eq("id", challengeId)
    .maybeSingle();
  if (!challenge || challenge.grading !== "auto" || !challenge.function_name) return { error: "Ce défi n'est pas corrigé automatiquement.", code };
  const now = Date.now();
  if (challenge.closed_at || now < Date.parse(challenge.starts_at) || now >= Date.parse(challenge.ends_at))
    return { error: "Le défi n'est pas ouvert.", code };

  const { data: rows } = await admin
    .from("challenge_tests")
    .select("args, expected, is_public")
    .eq("challenge_id", challengeId)
    .order("position");
  const tests = (rows ?? []) as TestCase[];

  if (mode === "test") {
    const report = await judge(code, challenge.function_name, tests.filter((t) => t.is_public));
    return { report, mode, code };
  }

  const { data: existing } = await admin
    .from("challenge_submissions")
    .select("id, score, challenge_solutions(attempts, last_attempt_at)")
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id)
    .maybeSingle();
  const sol = (existing?.challenge_solutions as unknown as { attempts: number; last_attempt_at: string } | null) ?? null;
  if (sol && now - Date.parse(sol.last_attempt_at) < COOLDOWN_MS)
    return { error: "Patiente quelques secondes entre deux soumissions.", code };
  if (sol && sol.attempts >= MAX_ATTEMPTS) return { error: `Tu as atteint la limite de ${MAX_ATTEMPTS} soumissions.`, code };

  const report = await judge(code, challenge.function_name, tests);
  const stamp = new Date().toISOString();
  const summary = { passed: report.passed, total: report.total };
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  if (!existing) {
    const { data: sub, error } = await admin
      .from("challenge_submissions")
      .insert({ challenge_id: challengeId, user_id: user.id, note, score: report.score, graded_at: stamp, auto_report: summary })
      .select("id")
      .single();
    if (error) return { error: error.message, code };
    await admin.from("challenge_solutions").insert({ submission_id: sub.id, code, report, attempts: 1, last_attempt_at: stamp });
    revalidatePath(path(challengeId));
    return { report, mode, code, message: `Score enregistré : ${report.score}/100.` };
  }

  const improved = existing.score === null || report.score > Number(existing.score);
  const attempts = (sol?.attempts ?? 0) + 1;
  if (improved) {
    await admin
      .from("challenge_submissions")
      .update({ score: report.score, graded_at: stamp, auto_report: summary, ...(note ? { note } : {}) })
      .eq("id", existing.id);
    await admin
      .from("challenge_solutions")
      .upsert({ submission_id: existing.id, code, report, attempts, last_attempt_at: stamp });
  } else {
    await admin.from("challenge_solutions").update({ attempts, last_attempt_at: stamp }).eq("submission_id", existing.id);
  }
  revalidatePath(path(challengeId));
  return {
    report,
    mode,
    code,
    message: improved
      ? `Nouveau meilleur score : ${report.score}/100.`
      : `Score de cette tentative : ${report.score}/100. Ton meilleur score (${Number(existing.score)}/100) est conservé.`,
  };
}

export async function submitSolution(challengeId: string, formData: FormData) {
  const { supabase, user } = await requireSession(path(challengeId));
  const { error } = await supabase.from("challenge_submissions").insert({
    challenge_id: challengeId,
    user_id: user.id,
    solution_url: String(formData.get("solution_url")).trim(),
    note: String(formData.get("note") || "") || null,
  });
  if (error) redirect(`${path(challengeId)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path(challengeId));
}

export async function scoreSubmission(challengeId: string, submissionId: string, formData: FormData) {
  const { supabase } = await requireSession(path(challengeId));
  const score = Math.max(0, Math.min(100, Number(formData.get("score"))));
  await supabase.from("challenge_submissions").update({ score }).eq("id", submissionId);
  revalidatePath(path(challengeId));
}

export async function closeChallenge(challengeId: string) {
  const { supabase } = await requireSession(path(challengeId));
  const { error } = await supabase.rpc("close_challenge", { p_challenge_id: challengeId });
  if (error) redirect(`${path(challengeId)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path(challengeId));
}
