import { dateLocale } from "@/lib/i18n/current";
import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { levelForXp } from "@/lib/levels";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  return { title: await pageTitle("Classements · Baobab Dev") };
}

type Row = {
  rank: number;
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  xp: number;
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pays?: string; ville?: string }>;
}) {
  const t = await getT();
  const { pays, ville } = await searchParams;
  const supabase = await createClient();

  const scope = ville ? "city" : pays ? "country" : "continent";
  const [{ data: rows }, { data: places }] = await Promise.all([
    supabase.rpc("leaderboard", { p_scope: scope, p_value: ville ?? pays ?? null, p_limit: 50 }),
    supabase.from("profiles").select("country, city").not("country", "is", null),
  ]);
  const countries = [...new Set((places ?? []).map((p) => p.country as string))].sort();
  const cities = [
    ...new Set(
      (places ?? []).filter((p) => !pays || p.country === pays).map((p) => p.city).filter(Boolean) as string[]
    ),
  ].sort();

  const allRows = ((rows ?? []) as Row[]);
  const podium = allRows.slice(0, 3);
  const remaining = allRows.slice(3);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
      active
        ? "bg-primary text-primary-ink shadow-xs"
        : "border border-border/80 bg-surface/70 text-muted hover:border-primary/40 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="border-b border-border/70 pb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gold/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-gold uppercase">
            {t("Honneur & Réputation")}
          </span>
          <span className="text-xs text-muted">{allRows.length}{" "}{t("développeurs classés")}</span>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl tracking-tight">{t("Classements communautaires")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("Périmètre actuel :")}{" "}<strong className="text-foreground">{ville ?? pays ?? t("Tout le continent")}</strong>
        </p>
      </div>

      {/* Filtres par continent et pays */}
      <div className="mt-6 space-y-2">
        <nav className="flex gap-2 overflow-x-auto pb-1 text-sm no-scrollbar">
          <Link href="/classements" className={chip(scope === "continent")}>
            {t("🌍 Tout le continent")}
          </Link>
          {countries.map((c) => (
            <Link key={c} href={`/classements?pays=${encodeURIComponent(c)}`} className={chip(pays === c && !ville)}>
              {c}
            </Link>
          ))}
        </nav>

        {pays && (
          <nav className="flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="inline-flex items-center text-xs font-semibold text-muted pr-1">{t("Villes :")}</span>
            {cities.map((c) => (
              <Link
                key={c}
                href={`/classements?pays=${encodeURIComponent(pays)}&ville=${encodeURIComponent(c)}`}
                className={chip(ville === c)}
              >
                {c}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Podium Top 3 */}
      {podium.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {podium.map((r, index) => {
            const isFirst = index === 0;
            const medal = isFirst ? "🥇 1er" : index === 1 ? "🥈 2e" : "🥉 3e";
            const borderGlow = isFirst
              ? "border-gold/80 bg-gold/5"
              : index === 1
              ? "border-silver/60 bg-surface/90"
              : "border-bronze/60 bg-surface/90";

            return (
              <div
                key={r.user_id}
                className={`flex flex-col items-center justify-between rounded-3xl border p-6 text-center transition ${borderGlow}`}
              >
                <div className="flex flex-col items-center">
                  <span className="font-mono text-xs font-bold text-primary mb-3">{medal}</span>
                  <Avatar user={r} size={64} />
                  <Link
                    href={`/u/${r.username}`}
                    className="mt-3 font-bold text-base text-foreground hover:text-primary transition"
                  >
                    {r.full_name ?? r.username}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {[r.city, r.country].filter(Boolean).join(", ")}
                  </p>
                  <span className="mt-2 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {levelForXp(r.xp).name}
                  </span>
                </div>

                <div className="mt-5 border-t border-border/50 pt-3 w-full">
                  <span className="font-mono font-extrabold text-lg text-foreground">
                    {r.xp.toLocaleString(dateLocale())} <span className="text-xs text-primary font-bold">{t("XP")}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suite du classement */}
      {remaining.length > 0 && (
        <ol className="mt-6 divide-y divide-border/60 rounded-3xl border border-border/80 bg-surface/85 shadow-xs overflow-hidden">
          {remaining.map((r) => (
            <li key={r.user_id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-background/40 transition">
              <span className="w-8 text-center font-mono font-bold text-muted text-sm">
                #{r.rank}
              </span>
              <Avatar user={r} size={36} />
              <div className="min-w-0 flex-1">
                <Link href={`/u/${r.username}`} className="font-bold text-sm text-foreground hover:text-primary transition">
                  {r.full_name ?? r.username}
                </Link>
                <p className="truncate text-xs text-muted">
                  {[r.city, r.country].filter(Boolean).join(", ")} · {levelForXp(r.xp).name}
                </p>
              </div>
              <span className="font-mono font-bold text-sm text-primary">
                {r.xp.toLocaleString(dateLocale())}{" "}{t("XP")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
