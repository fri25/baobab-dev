import Link from "next/link";
import { getSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { CHALLENGE_KIND } from "@/lib/labels";

export const metadata = { title: "Défis · Baobab Dev" };

export default async function ChallengesPage() {
  const { supabase, profile } = await getSession();
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, title, kind, sponsor_name, starts_at, ends_at, closed_at, challenge_submissions(count)")
    .order("ends_at", { ascending: false })
    .limit(20);

  const now = new Date();
  const current = (challenges ?? []).filter((c) => new Date(c.starts_at) <= now && new Date(c.ends_at) > now);
  const past = (challenges ?? []).filter((c) => new Date(c.ends_at) <= now);
  const isModerator = profile && ["moderator", "admin"].includes(profile.role);
  const count = (c: { challenge_submissions: unknown }) => (c.challenge_submissions as { count: number }[])[0]?.count ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Défis communautaires</h1>
          <p className="text-muted">Un défi par semaine. Jusqu&apos;à +100 XP pour le podium, classements par ville et par pays.</p>
        </div>
        {isModerator && (
          <Link href="/defis/new" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
            Lancer un défi
          </Link>
        )}
      </div>

      <h2 className="mt-8 font-semibold">En cours</h2>
      <ul className="mt-3 space-y-3">
        {current.map((c) => (
          <li key={c.id}>
            <Link href={`/defis/${c.id}`} className="block rounded-2xl border border-primary bg-surface p-5 hover:bg-background">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-ink">{CHALLENGE_KIND[c.kind]}</span>
                {c.sponsor_name && <span className="text-muted">Sponsorisé par {c.sponsor_name}</span>}
              </div>
              <p className="mt-2 text-lg font-semibold">{c.title}</p>
              <p className="mt-1 text-sm text-muted">
                {count(c)} participation(s) · se termine {timeAgo(c.ends_at)}
              </p>
            </Link>
          </li>
        ))}
        {!current.length && <li className="text-sm text-muted">Pas de défi en cours. Le prochain arrive bientôt.</li>}
      </ul>

      <h2 className="mt-10 font-semibold">Défis passés</h2>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
        {past.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <Link href={`/defis/${c.id}`} className="hover:text-primary">
              {c.title}
            </Link>
            <span className="shrink-0 text-xs text-muted">
              {c.closed_at ? "résultats publiés" : "en délibération"} · {count(c)} participation(s)
            </span>
          </li>
        ))}
        {!past.length && <li className="px-4 py-4 text-sm text-muted">Aucun.</li>}
      </ul>
    </main>
  );
}
