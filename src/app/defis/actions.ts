"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

const path = (id: string) => `/defis/${id}`;

export async function createChallenge(formData: FormData) {
  const { supabase, user } = await requireSession("/defis/new");
  const days = Number(formData.get("days")) || 7;
  const { data, error } = await supabase
    .from("challenges")
    .insert({
      title: String(formData.get("title")).trim(),
      description: String(formData.get("description")).trim(),
      kind: String(formData.get("kind")),
      sponsor_name: String(formData.get("sponsor_name") || "") || null,
      sponsor_url: String(formData.get("sponsor_url") || "") || null,
      ends_at: new Date(Date.now() + days * 86400000).toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) redirect(`/defis/new?error=${encodeURIComponent(error.message)}`);
  redirect(path(data.id));
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
