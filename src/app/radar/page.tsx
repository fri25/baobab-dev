import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { budgetLabel, ORG_TYPE, scoreClass } from "@/lib/radar-labels";
import { Deadline } from "./Deadline";
import { RadarLive } from "./RadarLive";

export async function generateMetadata() {
  return { title: await pageTitle("Radar d'opportunités · Baobab Dev") };
}

type Match = { opportunity_id: string; score: number; reasons: string[]; via_squad: string | null };

export default async function RadarPage({ searchParams }: { searchParams: Promise<{ tech?: string; pays?: string }> }) {
  const tr = await getT();
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
        <Link
          href={`/radar/${o.id}`}
          className="group flex flex-col justify-between gap-4 rounded-3xl border border-border/80 bg-surface/85 p-5 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg sm:flex-row sm:items-center sm:p-6"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-foreground">{o.organization_name}</span>
              <span>·</span>
              <span>{ORG_TYPE[o.org_type]}</span>
              {o.city && <span>· {o.city}</span>}
              {o.country && <span>, {o.country}</span>}
              {o.source === "collectee" && (
                <span className="rounded-md bg-tech/10 px-2 py-0.2 font-mono text-[10px] font-semibold text-tech">
                  {tr("Collecté")}
                </span>
              )}
            </p>

            <p className="mt-1.5 text-base font-bold text-foreground transition group-hover:text-primary sm:text-lg">
              {o.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">{o.need}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {o.technologies.map((t: string) => (
                <span
                  key={t}
                  className="rounded-lg border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[11px] font-medium text-muted"
                >
                  {t}
                </span>
              ))}
              <span className="text-muted">· {budgetLabel(o.budget_min, o.budget_max)}</span>
              <span className="text-muted">· {timeAgo(o.created_at)}</span>
              {o.deadline && <Deadline date={o.deadline} compact />}
            </div>

            {m && (
              <p className="mt-2 text-xs font-semibold text-leaf">
                {m.via_squad ? `Pour ta Squad « ${m.via_squad} » · ` : ""}
                {m.reasons.join(" · ")}
              </p>
            )}
          </div>

          {m && (
            <div
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl font-mono shadow-xs ${scoreClass(
                m.score
              )}`}
            >
              <span className="text-lg font-extrabold leading-none">{m.score}</span>
              <span className="text-[10px] opacity-80 leading-tight">/100</span>
            </div>
          )}
        </Link>
      </li>
    );
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-tech/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-tech uppercase">
              {tr("Veille & Appels d'offres")}
            </span>
            <span className="text-xs text-muted">{list.length}{" "}{tr("opportunités actives")}</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl tracking-tight">{tr("Radar d'opportunités")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {tr("Les besoins numériques des PME, ONG et collectivités, certifiés par l'administration. Chaque opportunité est comparée en direct à ton profil et à tes Squads.")}
          </p>
          <div className="mt-3">
            <RadarLive imminent={imminent.length} />
          </div>
        </div>

        <Link
          href="/radar/publier"
          className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-ink shadow-md shadow-primary/20 transition hover:opacity-95 hover:shadow-lg sm:text-sm"
        >
          <span>{tr("+ Publier un besoin")}</span>
        </Link>
      </div>

      {/* Filtres par pays */}
      <nav className="mt-6 flex flex-wrap gap-2 text-xs sm:text-sm">
        <Link
          href="/radar"
          className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
            !tech && !pays
              ? "bg-primary text-primary-ink shadow-xs"
              : "border border-border/80 bg-surface/70 text-muted hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {tr("Toutes")}
        </Link>
        {countries.map((c) => (
          <Link
            key={c}
            href={`/radar?pays=${encodeURIComponent(c)}`}
            className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
              pays === c
                ? "bg-primary text-primary-ink shadow-xs"
                : "border border-border/80 bg-surface/70 text-muted hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {c}
          </Link>
        ))}
        {tech && (
          <span className="rounded-full bg-foreground px-3.5 py-1.5 text-xs font-bold text-background">
            {tr("Technologie :")}{" "}{tech}
          </span>
        )}
      </nav>

      {/* Mes publications en attente */}
      {(waiting?.length ?? 0) > 0 && (
        <section className="mt-6 rounded-2xl border border-border/80 bg-surface/80 p-5 text-sm backdrop-blur-sm">
          <h2 className="font-bold text-foreground">{tr("Mes publications non encore visibles")}</h2>
          <ul className="mt-2.5 space-y-1.5">
            {waiting!.map((w) => (
              <li key={w.id} className="text-xs">
                <Link href={`/radar/${w.id}`} className="font-semibold text-primary hover:underline">
                  {w.title}
                </Link>{" "}
                <span className={`text-muted`}>
                  · {w.status === "draft" ? tr("brouillon à vérifier") : w.status === "pending" ? tr("en attente de validation") : `refusée${w.review_note ? ` : ${w.review_note}` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Échéances imminentes */}
      {imminent.length > 0 && (
        <section className="mt-8 rounded-2xl border border-primary/40 bg-primary/5 p-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <h2 className="font-bold text-primary text-base sm:text-lg">
              {tr("Échéances imminentes (")}{imminent.length})
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            {tr("Date limite de candidature dans moins de 7 jours. Compte à rebours mis à jour en temps réel.")}
          </p>
          <ul className="mt-4 space-y-3.5">{imminent.map((o) => card(o))}</ul>
        </section>
      )}

      {/* Autres opportunités */}
      <ul className="mt-6 space-y-3.5">
        {others.map((o) => card(o))}
        {!list.length && (
          <li className="rounded-3xl border border-dashed border-border bg-surface/50 p-12 text-center text-sm text-muted">
            {tr("Aucune opportunité ouverte dans cette sélection.")}
          </li>
        )}
      </ul>
    </main>
  );
}
