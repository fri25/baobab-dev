import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { levelForXp } from "@/lib/levels";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Classements · Baobab Dev" };

type Row = { rank: number; user_id: string; username: string; full_name: string | null; avatar_url: string | null; city: string | null; country: string | null; xp: number };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ pays?: string; ville?: string }> }) {
  const { pays, ville } = await searchParams;
  const supabase = await createClient();

  const scope = ville ? "city" : pays ? "country" : "continent";
  const [{ data: rows }, { data: places }] = await Promise.all([
    supabase.rpc("leaderboard", { p_scope: scope, p_value: ville ?? pays ?? null, p_limit: 50 }),
    supabase.from("profiles").select("country, city").not("country", "is", null),
  ]);
  const countries = [...new Set((places ?? []).map((p) => p.country as string))].sort();
  const cities = [...new Set((places ?? []).filter((p) => !pays || p.country === pays).map((p) => p.city).filter(Boolean) as string[])].sort();

  const chip = (active: boolean) => `shrink-0 rounded-full px-3 py-1 ${active ? "bg-foreground text-background" : "border border-border"}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Classements</h1>
      <p className="text-muted">{ville ?? pays ?? "Tout le continent"}</p>

      <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 text-sm">
        <Link href="/classements" className={chip(scope === "continent")}>
          Continent
        </Link>
        {countries.map((c) => (
          <Link key={c} href={`/classements?pays=${encodeURIComponent(c)}`} className={chip(pays === c && !ville)}>
            {c}
          </Link>
        ))}
      </nav>
      {pays && (
        <nav className="mt-2 flex gap-2 overflow-x-auto pb-1 text-sm">
          {cities.map((c) => (
            <Link key={c} href={`/classements?pays=${encodeURIComponent(pays)}&ville=${encodeURIComponent(c)}`} className={chip(ville === c)}>
              {c}
            </Link>
          ))}
        </nav>
      )}

      <ol className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
        {((rows ?? []) as Row[]).map((r) => (
          <li key={r.user_id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`w-8 text-center font-mono font-bold ${r.rank === 1 ? "text-gold" : r.rank === 2 ? "text-silver" : r.rank === 3 ? "text-bronze" : "text-muted"}`}
            >
              {r.rank}
            </span>
            <Avatar user={r} size={36} />
            <div className="min-w-0 flex-1">
              <Link href={`/u/${r.username}`} className="font-medium hover:text-primary">
                {r.full_name ?? r.username}
              </Link>
              <p className="truncate text-xs text-muted">
                {[r.city, r.country].filter(Boolean).join(", ")} · {levelForXp(r.xp).name}
              </p>
            </div>
            <span className="font-mono font-semibold text-primary">{r.xp.toLocaleString("fr-FR")} XP</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
