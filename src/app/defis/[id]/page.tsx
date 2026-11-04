import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { getSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { CHALLENGE_KIND } from "@/lib/labels";
import { closeChallenge, scoreSubmission, submitSolution } from "../actions";

type Row = {
  rank: number;
  user_id: string;
  username: string;
  full_name: string | null;
  city: string | null;
  country: string | null;
  score: number | null;
  solution_url: string;
};

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function ChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; pays?: string; ville?: string }>;
}) {
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
  const subOf = new Map((subs ?? []).map((s) => [s.user_id, s]));
  const countries = [...new Set(board.map((r) => r.country).filter(Boolean))] as string[];

  const now = new Date();
  const isOpen = new Date(challenge.starts_at) <= now && new Date(challenge.ends_at) > now;
  const isModerator = profile && ["moderator", "admin"].includes(profile.role);
  const mine = user ? subOf.get(user.id) : undefined;
  const closed = Boolean(challenge.closed_at);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/defis" className="text-sm text-muted hover:text-primary">
        ← Défis
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-ink">{CHALLENGE_KIND[challenge.kind]}</span>
        <span className="text-muted">
          {isOpen ? `se termine ${timeAgo(challenge.ends_at)}` : closed ? "résultats publiés" : "terminé, en délibération"}
        </span>
        {challenge.sponsor_name && (
          <a href={challenge.sponsor_url ?? undefined} className="text-gold">
            Sponsorisé par {challenge.sponsor_name}
          </a>
        )}
      </div>
      <h1 className="mt-2 text-2xl font-bold">{challenge.title}</h1>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <article className="mt-6 rounded-xl border border-border bg-surface p-5">
        <Markdown text={challenge.description} />
        <p className="mt-4 text-sm text-muted">Podium : +100, +60 et +30 XP. Correction par le jury.</p>
      </article>

      {user && isOpen && !mine && (
        <form action={submitSolution.bind(null, id)} className="mt-6 space-y-2 rounded-xl border border-dashed border-border p-4">
          <h2 className="font-semibold">Ta participation</h2>
          <input
            name="solution_url"
            type="url"
            required
            placeholder="https://github.com/moi/ma-solution"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
          />
          <input name="note" placeholder="Un mot pour le jury (facultatif)" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">Participer</button>
        </form>
      )}
      {mine && <p className="mt-6 rounded-lg bg-leaf/10 p-3 text-sm text-leaf">Ta participation est enregistrée.</p>}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Classement</h2>
          <nav className="flex flex-wrap gap-2 text-xs">
            <Link href={`/defis/${id}`} className={`rounded-full px-3 py-1 ${scope === "all" ? "bg-foreground text-background" : "border border-border"}`}>
              Tous
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
                    {[r.city, r.country].filter(Boolean).join(", ")} ·{" "}
                    <a href={r.solution_url} className="text-primary">
                      solution
                    </a>
                    {sub?.note && ` · ${sub.note}`}
                  </p>
                </div>
                {isModerator && !closed && sub ? (
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
                    <button className="rounded border border-border px-2 text-xs">Noter</button>
                  </form>
                ) : (
                  <span className="font-mono font-semibold">{r.score ?? "—"}</span>
                )}
              </li>
            );
          })}
          {!board.length && <li className="px-4 py-4 text-sm text-muted">Aucune participation.</li>}
        </ol>
        {isModerator && !closed && board.length > 0 && (
          <form action={closeChallenge.bind(null, id)} className="mt-3">
            <button className="rounded-full bg-leaf px-5 py-2 text-sm font-medium text-background">
              Publier les résultats et attribuer les XP
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
