import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { getSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { CHALLENGE_KIND } from "@/lib/labels";
import { closeChallenge, scoreSubmission, submitSolution } from "../actions";
import { AutoSubmitForm } from "./AutoSubmitForm";

type Row = {
  rank: number;
  user_id: string;
  username: string;
  full_name: string | null;
  city: string | null;
  country: string | null;
  score: number | null;
  solution_url: string | null;
  auto_report: { passed: number; total: number } | null;
};

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function ChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; pays?: string; ville?: string }>;
}) {
  const tr = await getT();
  const { id } = await params;
  const { error, pays, ville } = await searchParams;
  const { supabase, user, profile } = await getSession();

  const { data: challenge } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (!challenge) notFound();

  const scope = ville ? "city" : pays ? "country" : "all";
  const [{ data: rows }, { data: subs }] = await Promise.all([
    supabase.rpc("challenge_leaderboard", { p_challenge_id: id, p_scope: scope, p_value: ville ?? pays ?? null }),
    supabase.from("challenge_submissions").select("id, user_id, note, score").eq("challenge_id", id),
  ]);
  const board = (rows ?? []) as Row[];
  const isAuto = challenge.grading === "auto";
  const subOf = new Map((subs ?? []).map((s) => [s.user_id, s]));
  const countries = [...new Set(board.map((r) => r.country).filter(Boolean))] as string[];

  const now = new Date();
  const isOpen = new Date(challenge.starts_at) <= now && new Date(challenge.ends_at) > now;
  const isModerator = profile && ["moderator", "admin"].includes(profile.role);
  const mine = user ? subOf.get(user.id) : undefined;
  const closed = Boolean(challenge.closed_at);

  // Correction automatique : exemples publics (les tests cachés restent invisibles jusqu'à la clôture)
  let examples: { args: unknown[]; expected: unknown; is_public: boolean }[] = [];
  let counts = { total: 0, public_count: 0 };
  let myCode: string | null = null;
  let myAttempts = 0;
  if (isAuto) {
    const [{ data: tests }, { data: c }, { data: sol }] = await Promise.all([
      supabase.from("challenge_tests").select("args, expected, is_public").eq("challenge_id", id).order("position"),
      supabase.rpc("challenge_test_counts", { p_challenge_id: id }).single<{ total: number; public_count: number }>(),
      mine
        ? supabase.from("challenge_solutions").select("code, attempts").eq("submission_id", mine.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    examples = tests ?? [];
    if (c) counts = c;
    myCode = sol?.code ?? null;
    myAttempts = sol?.attempts ?? 0;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/defis" className="text-sm text-muted hover:text-primary">
        {tr("← Défis")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-ink">{CHALLENGE_KIND[challenge.kind]}</span>
        <span className="text-muted">
          {isOpen ? tr("se termine {when}", { when: timeAgo(challenge.ends_at) }) : closed ? tr("résultats publiés") : tr("terminé, en délibération")}
        </span>
        {challenge.sponsor_name && (
          <a href={challenge.sponsor_url ?? undefined} className="text-gold">
            {tr("Sponsorisé par")}{" "}{challenge.sponsor_name}
          </a>
        )}
      </div>
      <h1 className="mt-2 text-2xl font-bold">{challenge.title}</h1>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <article className="mt-6 rounded-xl border border-border bg-surface p-5">
        <Markdown text={challenge.description} />
        <p className="mt-4 text-sm text-muted">
          {tr("Podium : +100, +60 et +30 XP.")}{" "}
          {isAuto
            ? tr("Correction automatique : {total} tests, dont {hidden} cachés. À score égal, le premier à l'atteindre l'emporte.", { total: counts.total, hidden: counts.total - counts.public_count })
            : tr("Correction par le jury.")}
        </p>
      </article>

      {isAuto && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">
            {tr("Signature :")}{" "}<code className="font-mono">{challenge.function_name}(…)</code>
          </h2>
          <ul className="mt-3 space-y-1 font-mono text-xs">
            {examples.map((t, i) => (
              <li key={i} className="rounded bg-background px-3 py-2">
                {challenge.function_name}({t.args.map((a) => JSON.stringify(a)).join(", ")}) → {JSON.stringify(t.expected)}
                {!t.is_public && <span className="text-muted">{" "}{tr("(test caché)")}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAuto && user && isOpen && !closed && (
        <AutoSubmitForm challengeId={id} initialCode={myCode ?? challenge.starter_code ?? ""} hasSubmission={Boolean(mine)} />
      )}
      {isAuto && mine && (
        <p className="mt-3 text-sm text-muted">
          {tr("Ton meilleur score :")}{" "}<strong className="text-foreground">{mine.score ?? "—"}/100</strong> · {myAttempts}{" "}{tr("soumission(s)")}
        </p>
      )}

      {!isAuto && user && isOpen && !mine && (
        <form action={submitSolution.bind(null, id)} className="mt-6 space-y-2 rounded-xl border border-dashed border-border p-4">
          <h2 className="font-semibold">{tr("Ta participation")}</h2>
          <input
            name="solution_url"
            type="url"
            required
            placeholder={tr("https://github.com/moi/ma-solution")}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
          />
          <input name="note" placeholder={tr("Un mot pour le jury (facultatif)")} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">{tr("Participer")}</button>
        </form>
      )}
      {!isAuto && mine && <p className="mt-6 rounded-lg bg-leaf/10 p-3 text-sm text-leaf">{tr("Ta participation est enregistrée.")}</p>}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{tr("Classement")}</h2>
          <nav className="flex flex-wrap gap-2 text-xs">
            <Link href={`/defis/${id}`} className={`rounded-full px-3 py-1 ${scope === "all" ? "bg-foreground text-background" : "border border-border"}`}>
              {tr("Tous")}
            </Link>
            {countries.map((c) => (
              <Link
                key={c}
                href={`/defis/${id}?pays=${encodeURIComponent(c)}`}
                className={`rounded-full px-3 py-1 ${pays === c ? "bg-foreground text-background" : "border border-border"}`}
              >
                {c}
              </Link>
            ))}
          </nav>
        </div>
        <ol className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
          {board.map((r) => {
            const sub = subOf.get(r.user_id);
            return (
              <li key={r.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="w-8 text-center font-mono">{closed && r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${r.username}`} className="font-medium hover:text-primary">
                    {r.full_name ?? r.username}
                  </Link>
                  <p className="text-xs text-muted">
                    {[r.city, r.country].filter(Boolean).join(", ")}
                    {r.solution_url && (
                      <>
                        {" · "}
                        <a href={r.solution_url} className="text-primary">
                          {tr("solution")}
                        </a>
                      </>
                    )}
                    {r.auto_report && ` · ${r.auto_report.passed}/${r.auto_report.total} tests`}
                    {sub?.note && ` · ${sub.note}`}
                  </p>
                </div>
                {isModerator && !closed && sub && !isAuto ? (
                  <form action={scoreSubmission.bind(null, id, sub.id)} className="flex gap-1">
                    <input
                      name="score"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={r.score ?? undefined}
                      placeholder="/100"
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                    <button className="rounded border border-border px-2 text-xs">{tr("Noter")}</button>
                  </form>
                ) : (
                  <span className="font-mono font-semibold">{r.score ?? "—"}</span>
                )}
              </li>
            );
          })}
          {!board.length && <li className="px-4 py-4 text-sm text-muted">{tr("Aucune participation.")}</li>}
        </ol>
        {isModerator && !closed && board.length > 0 && (
          <form action={closeChallenge.bind(null, id)} className="mt-3">
            <button className="rounded-full bg-leaf px-5 py-2 text-sm font-medium text-background">
              {tr("Publier les résultats et attribuer les XP")}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
