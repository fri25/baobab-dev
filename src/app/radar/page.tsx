import Link from "next/link";
import { getSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { budgetLabel, ORG_TYPE, scoreClass } from "@/lib/radar-labels";

export const metadata = { title: "Radar d'opportunités · Baobab Dev" };

type Match = { opportunity_id: string; score: number; reasons: string[]; via_squad: string | null };

export default async function RadarPage({ searchParams }: { searchParams: Promise<{ tech?: string; pays?: string }> }) {
  const { tech, pays } = await searchParams;
  const { supabase, user } = await getSession();

  let query = supabase
    .from("opportunities")
    .select("id, source, organization_name, org_type, title, need, technologies, budget_min, budget_max, deadline, country, city, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);
  if (tech) query = query.contains("technologies", [tech]);
  if (pays) query = query.eq("country", pays);
  const [{ data: opportunities }, { data: mine }] = await Promise.all([
    query,
    user ? supabase.rpc("my_opportunities") : Promise.resolve({ data: [] }),
  ]);
  const matchOf = new Map(((mine ?? []) as Match[]).map((m) => [m.opportunity_id, m]));
  const list = (opportunities ?? []).sort((a, b) => (matchOf.get(b.id)?.score ?? -1) - (matchOf.get(a.id)?.score ?? -1));
  const countries = [...new Set((opportunities ?? []).map((o) => o.country).filter(Boolean))] as string[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Radar d&apos;opportunités</h1>
          <p className="max-w-2xl text-muted">
            Les besoins numériques des PME, ONG et collectivités, et les appels d&apos;offres collectés. Chaque opportunité est
            comparée à ton profil et à tes Squads : les plus proches remontent en premier.
          </p>
        </div>
        <Link href="/radar/publier" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
          Publier un besoin
        </Link>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href="/radar" className={`rounded-full px-3 py-1 ${!tech && !pays ? "bg-foreground text-background" : "border border-border"}`}>
          Toutes
        </Link>
        {countries.map((c) => (
          <Link key={c} href={`/radar?pays=${encodeURIComponent(c)}`} className={`rounded-full px-3 py-1 ${pays === c ? "bg-foreground text-background" : "border border-border"}`}>
            {c}
          </Link>
        ))}
        {tech && <span className="rounded-full bg-foreground px-3 py-1 text-background">{tech}</span>}
      </nav>

      <ul className="mt-6 space-y-3">
        {list.map((o) => {
          const m = matchOf.get(o.id);
          return (
            <li key={o.id}>
              <Link href={`/radar/${o.id}`} className="flex gap-4 rounded-xl border border-border bg-surface p-4 hover:border-primary">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {o.organization_name} · {ORG_TYPE[o.org_type]}
                    {o.city && ` · ${o.city}`}
                    {o.country && `, ${o.country}`}
                    {o.source === "collectee" && " · appel d'offres collecté"}
                  </p>
                  <p className="mt-1 font-medium">{o.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{o.need}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {o.technologies.map((t: string) => (
                      <span key={t} className="rounded bg-background px-2 py-0.5 font-mono">
                        {t}
                      </span>
                    ))}
                    <span className="text-muted">
                      · {budgetLabel(o.budget_min, o.budget_max)}
                      {o.deadline && ` · avant le ${new Date(o.deadline).toLocaleDateString("fr-FR")}`} · {timeAgo(o.created_at)}
                    </span>
                  </div>
                  {m && <p className="mt-2 text-xs text-leaf">{m.via_squad ? `Pour ta Squad « ${m.via_squad} » · ` : ""}{m.reasons.join(" · ")}</p>}
                </div>
                {m && (
                  <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-mono ${scoreClass(m.score)}`}>
                    <span className="text-lg font-bold">{m.score}</span>
                    <span className="text-[10px]">/100</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        {!list.length && <li className="text-sm text-muted">Aucune opportunité ouverte pour l&apos;instant.</li>}
      </ul>
    </main>
  );
}
