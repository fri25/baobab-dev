import { getT, pageTitle } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectNow, reviewOpportunity } from "@/app/radar/actions";
import { Deadline } from "@/app/radar/Deadline";
import { budgetLabel, ORG_TYPE } from "@/lib/radar-labels";

export async function generateMetadata() {
  return { title: await pageTitle("Modération · Baobab Dev") };
}

const TARGET_HREF: Record<string, (id: string) => string> = {
  question: (id) => `/questions/${id}`,
  answer: () => "/questions",
  project: () => "/showroom",
  comment: () => "/questions",
  profile: () => "/classements",
  griot_query: () => "/griot",
  message: () => "/discussions?onglet=sujets",
  audit_finding: () => "/forensic",
};

async function addRadarSource(formData: FormData) {
  "use server";
  const { supabase } = await requireSession("/moderation");
  await supabase.from("radar_sources").insert({
    name: String(formData.get("name")).trim(),
    url: String(formData.get("url")).trim(),
    country: String(formData.get("country") || "") || null,
  });
  revalidatePath("/moderation");
}

async function toggleRadarSource(id: string, active: boolean) {
  "use server";
  const { supabase } = await requireSession("/moderation");
  await supabase.from("radar_sources").update({ active }).eq("id", id);
  revalidatePath("/moderation");
}

async function distributeRebate(formData: FormData) {
  "use server";
  const { supabase } = await requireSession("/moderation");
  await supabase.rpc("distribute_infra_rebate", { p_year: Number(formData.get("year")) });
  revalidatePath("/moderation");
}

async function moderate(reportId: number, action: "remove" | "dismiss") {
  "use server";
  const { supabase } = await requireSession("/moderation");
  await supabase.rpc("moderate_report", { p_report_id: reportId, p_action: action });
  revalidatePath("/moderation");
}

export default async function ModerationPage() {
  const tr = await getT();
  const { supabase, profile } = await requireSession("/moderation");
  if (!["moderator", "admin"].includes(profile.role)) notFound();

  const { data: sources } = await supabase.from("radar_sources").select("id, name, url, country, active, last_fetched_at").order("name");
  // File de validation du Radar : les échéances les plus proches d'abord
  const { data: pending } = await supabase
    .from("opportunities")
    .select("id, source, organization_name, org_type, title, need, technologies, budget_min, budget_max, deadline, country, source_url, created_at")
    .eq("status", "pending")
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at");
  const [{ data: reports }, { data: disputes }, stats] = await Promise.all([
    supabase
      .from("reports")
      .select("id, target_type, target_id, reason, created_at, reporter:profiles!reports_reporter_id_fkey(username)")
      .eq("status", "open")
      .order("created_at"),
    supabase.from("disputes").select("id, reason, status, created_at, bounty:bounties(id, title, total_amount)").eq("status", "open"),
    Promise.all(
      ["profiles", "questions", "answers", "projects", "squads", "bounties", "griot_queries"].map((t) =>
        createAdminClient().from(t).select("*", { count: "exact", head: true }),
      ),
    ),
  ]);
  const labels = ["Devs", "Questions", "Réponses", "Projets", "Squads", "Tickets", "Questions au Griot"];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">{tr("Modération et administration")}</h1>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s, i) => (
          <div key={labels[i]} className="rounded-xl border border-border bg-surface p-3">
            <p className="font-mono text-2xl font-bold">{s.count ?? "—"}</p>
            <p className="text-xs text-muted">{labels[i]}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{tr("Radar : opportunités à valider (")}{pending?.length ?? 0})</h2>
          <form action={collectNow}>
            <button className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary">{tr("Collecter les flux maintenant")}</button>
          </form>
        </div>
        <p className="text-xs text-muted">
          {tr("Appels d'offres collectés et besoins publiés par les organisations. Rien n'est visible du public avant validation ; traite d'abord les dates limites proches.")}
        </p>
        <ul className="mt-3 space-y-2">
          {pending?.map((o) => (
            <li key={o.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    {o.organization_name} · {ORG_TYPE[o.org_type]} {o.country && `· ${o.country}`} ·{" "}
                    {o.source === "collectee" ? tr("collecté") : tr("publié")} {timeAgo(o.created_at)}
                  </p>
                  <Link href={`/radar/${o.id}`} className="font-medium hover:text-primary">
                    {o.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-muted">{o.need}</p>
                  <p className="mt-1 text-xs text-muted">
                    {o.technologies.join(", ") || tr("Technologies non détectées")} · {budgetLabel(o.budget_min, o.budget_max)}
                  </p>
                  {o.source_url && (
                    <a href={o.source_url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate font-mono text-xs text-primary">
                      {o.source_url}
                    </a>
                  )}
                </div>
                {o.deadline ? <Deadline date={o.deadline} compact /> : <span className="text-xs text-muted">{tr("Sans date limite")}</span>}
              </div>
              <form className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="back" value="/moderation" />
                <input name="note" placeholder={tr("Motif (si refus)")} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs" />
                <button formAction={reviewOpportunity.bind(null, o.id, true)} className="rounded-full bg-leaf px-3 py-1 text-xs font-medium text-background">
                  {tr("Valider et publier")}
                </button>
                <button formAction={reviewOpportunity.bind(null, o.id, false)} className="rounded-full border border-border px-3 py-1 text-xs">
                  {tr("Refuser")}
                </button>
              </form>
            </li>
          ))}
          {!pending?.length && <li className="text-sm text-muted">{tr("Aucune opportunité en attente.")}</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">{tr("Signalements ouverts (")}{reports?.length ?? 0})</h2>
        <ul className="mt-3 space-y-2">
          {reports?.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
              <div>
                <p className="font-medium">{r.reason}</p>
                <p className="text-xs text-muted">
                  {r.target_type} ·{" "}
                  <Link href={TARGET_HREF[r.target_type](r.target_id)} className="text-primary">
                    {tr("voir")}
                  </Link>{" "}
                  {tr("· par @")}{(r.reporter as unknown as { username: string }).username} · {timeAgo(r.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={moderate.bind(null, r.id, "remove")}>
                  <button className="rounded-full bg-primary px-3 py-1 text-xs text-primary-ink">{tr("Supprimer (-15 XP)")}</button>
                </form>
                <form action={moderate.bind(null, r.id, "dismiss")}>
                  <button className="rounded-full border border-border px-3 py-1 text-xs">{tr("Classer")}</button>
                </form>
              </div>
            </li>
          ))}
          {!reports?.length && <li className="text-sm text-muted">{tr("File vide.")}</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">{tr("Litiges de la Micro-Bourse")}</h2>
        <ul className="mt-3 space-y-2">
          {disputes?.map((d) => {
            const bounty = d.bounty as unknown as { id: string; title: string; total_amount: number };
            return (
              <li key={d.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
                <Link href={`/bourse/${bounty.id}`} className="font-medium hover:text-primary">
                  {bounty.title}
                </Link>{" "}
                <span className="font-mono text-gold">{fcfa(bounty.total_amount)}</span>
                <p className="mt-1 text-muted">{d.reason}</p>
              </li>
            );
          })}
          {!disputes?.length && <li className="text-sm text-muted">{tr("Aucun litige.")}</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">{tr("Sources du Radar (flux RSS ou Atom d'appels d'offres)")}</h2>
        <p className="text-xs text-muted">{tr("Collectées automatiquement : seules les annonces liées au numérique sont retenues, puis placées dans la file de validation ci-dessus.")}</p>
        <ul className="mt-3 space-y-2">
          {sources?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{s.name}</span> {s.country && <span className="text-muted">· {s.country}</span>}
                <span className="block truncate font-mono text-xs text-muted">{s.url}</span>
                <span className="text-xs text-muted">{s.last_fetched_at ? `collectée ${timeAgo(s.last_fetched_at)}` : tr("jamais collectée")}</span>
              </span>
              <form action={toggleRadarSource.bind(null, s.id, !s.active)}>
                <button className="rounded-full border border-border px-3 py-1 text-xs">{s.active ? tr("Désactiver") : tr("Activer")}</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addRadarSource} className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]">
          <input name="name" required placeholder={tr("Nom de la source")} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <input name="url" type="url" required placeholder={tr("https://…/flux.rss")} className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm" />
          <input name="country" placeholder={tr("Pays")} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <button className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink">{tr("Ajouter")}</button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">{tr("Centrale d'achat : ristourne annuelle")}</h2>
        <p className="text-xs text-muted">{tr("20 % de la marge de l'année, reversés en crédits au prorata de la consommation de chaque membre. Une seule fois par an.")}</p>
        <form action={distributeRebate} className="mt-2 flex gap-2">
          <input name="year" type="number" defaultValue={new Date().getFullYear() - 1} className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <button className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink">{tr("Verser la ristourne")}</button>
        </form>
      </section>
    </main>
  );
}
