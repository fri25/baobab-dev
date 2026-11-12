import Link from "next/link";
import { getSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { budgetLabel, ORG_TYPE, scoreClass } from "@/lib/radar-labels";
import { Deadline } from "./Deadline";
import { RadarLive } from "./RadarLive";

export const metadata = { title: "Radar d'opportunités · Baobab Dev" };

type Match = { opportunity_id: string; score: number; reasons: string[]; via_squad: string | null };

export default async function RadarPage({ searchParams }: { searchParams: Promise<{ tech?: string; pays?: string }> }) {
  const { tech, pays } = await searchParams;
  const { supabase, user } = await getSession();

  // Uniquement les opportunités validées par l'administration et dont la date limite n'est pas passée
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("opportunities")
    .select("id, source, organization_name, org_type, title, need, technologies, budget_min, budget_max, deadline, country, city, created_at")
    .eq("status", "open")
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (tech) query = query.contains("technologies", [tech]);
  if (pays) query = query.eq("country", pays);
  const [{ data: opportunities }, { data: mine }, { data: waiting }] = await Promise.all([
    query,
    user ? supabase.rpc("my_opportunities") : Promise.resolve({ data: [] }),
    user
      ? supabase.from("opportunities").select("id, title, status, review_note").eq("publisher_id", user.id).in("status", ["draft", "pending", "rejected"])
      : Promise.resolve({ data: [] }),
  ]);
  const matchOf = new Map(((mine ?? []) as Match[]).map((m) => [m.opportunity_id, m]));
  const list = (opportunities ?? []).sort((a, b) => (matchOf.get(b.id)?.score ?? -1) - (matchOf.get(a.id)?.score ?? -1));
  const countries = [...new Set((opportunities ?? []).map((o) => o.country).filter(Boolean))] as string[];
  // Échéances imminentes (7 jours) : remontées en tête, de la plus proche à la plus lointaine
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const imminent = list.filter((o) => o.deadline && o.deadline <= soon).sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  const others = list.filter((o) => !imminent.includes(o));

  type Opportunity = NonNullable<typeof opportunities>[number];
  const card = (o: Opportunity) => {
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
                {" "}· {timeAgo(o.created_at)}
              </span>
              {o.deadline && <Deadline date={o.deadline} compact />}
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
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Radar d&apos;opportunités</h1>
          <p className="max-w-2xl text-muted">
            Les besoins numériques des PME, ONG et collectivités, et les appels d&apos;offres collectés. Chaque opportunité est
            comparée à ton profil et à tes Squads : les plus proches remontent en premier. Toutes sont vérifiées par
            l&apos;administration avant publication.
          </p>
          <p className="mt-2">
            <RadarLive imminent={imminent.length} />
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

      {(waiting?.length ?? 0) > 0 && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
          <h2 className="font-semibold">Mes publications non encore visibles</h2>
          <ul className="mt-2 space-y-1">
            {waiting!.map((w) => (
              <li key={w.id}>
                <Link href={`/radar/${w.id}`} className="hover:text-primary">
                  {w.title}
                </Link>{" "}
                <span className={`text-xs ${w.status === "rejected" ? "text-primary" : "text-muted"}`}>
                  · {w.status === "draft" ? "brouillon à vérifier" : w.status === "pending" ? "en attente de validation" : `refusée${w.review_note ? ` : ${w.review_note}` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {imminent.length > 0 && (
        <section className="mt-6 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-primary">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Échéances imminentes ({imminent.length})
          </h2>
          <p className="text-xs text-muted">Date limite de candidature dans moins de 7 jours. Le compte à rebours est mis à jour en direct.</p>
          <ul className="mt-3 space-y-3">{imminent.map((o) => card(o))}</ul>
        </section>
      )}

      <ul className="mt-6 space-y-3">
        {others.map((o) => card(o))}
        {!list.length && <li className="text-sm text-muted">Aucune opportunité ouverte pour l&apos;instant.</li>}
      </ul>
    </main>
  );
}
