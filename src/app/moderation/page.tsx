import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateOpportunity } from "@/app/radar/actions";

export const metadata = { title: "Modération · Baobab Dev" };

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

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ radar?: string; radarError?: string }>;
}) {
  const { supabase, profile } = await requireSession("/moderation");
  if (!["moderator", "admin"].includes(profile.role)) notFound();
  const { radar, radarError } = await searchParams;

  const [{ data: sources }, { data: pendingOpportunities }, { data: reports }, { data: disputes }, stats] = await Promise.all([
    supabase.from("radar_sources").select("id, name, url, country, active, last_fetched_at").order("name"),
    supabase
      .from("opportunities")
      .select("id, source, source_url, organization_name, title, raw_text, deadline, created_at")
      .eq("status", "pending_review")
      .order("created_at"),
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
      <h1 className="text-2xl font-bold">Modération et administration</h1>
      {radar === "approved" && <p className="mt-4 rounded-lg bg-leaf/10 p-3 text-sm text-leaf">Opportunité validée et publiée.</p>}
      {radar === "rejected" && <p className="mt-4 rounded-lg bg-leaf/10 p-3 text-sm text-leaf">Opportunité refusée; son auteur peut la corriger et la soumettre à nouveau.</p>}
      {radarError && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{radarError}</p>}

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s, i) => (
          <div key={labels[i]} className="rounded-xl border border-border bg-surface p-3">
            <p className="font-mono text-2xl font-bold">{s.count ?? "—"}</p>
            <p className="text-xs text-muted">{labels[i]}</p>
          </div>
        ))}
      </section>

      <section id="radar-review" className="mt-8 scroll-mt-20">
        <h2 className="font-semibold">Radar : annonces à valider ({pendingOpportunities?.length ?? 0})</h2>
        <p className="mt-1 text-xs text-muted">
          Une annonce n’est visible dans le Radar et ne déclenche des alertes qu’après validation.
        </p>
        <ul className="mt-3 space-y-3">
          {pendingOpportunities?.map((opportunity) => (
            <li key={opportunity.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    {opportunity.organization_name} · {opportunity.source === "collectee" ? "appel d’offres collecté" : "soumis par une organisation"}
                    {opportunity.deadline && ` · échéance ${new Date(opportunity.deadline).toLocaleDateString("fr-FR")}`}
                  </p>
                  <Link href={`/radar/${opportunity.id}`} className="mt-1 inline-block font-semibold hover:text-primary">
                    {opportunity.title}
                  </Link>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted">{opportunity.raw_text}</p>
                  {opportunity.source_url && (
                    <a href={opportunity.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-primary hover:underline">
                      Consulter l’annonce d’origine
                    </a>
                  )}
                  <p className="mt-2 text-xs text-muted">Reçue {timeAgo(opportunity.created_at)}</p>
                </div>
                <form action={moderateOpportunity.bind(null, opportunity.id)}>
                  <input type="hidden" name="action" value="approve" />
                  <button className="rounded-full bg-leaf px-4 py-2 text-sm font-medium text-background">Valider et publier</button>
                </form>
              </div>
              <form action={moderateOpportunity.bind(null, opportunity.id)} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <input type="hidden" name="action" value="reject" />
                <label className="min-w-56 flex-1 text-sm">
                  Motif de refus (visible par l&apos;organisation)
                  <input name="note" required minLength={5} maxLength={500} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
                </label>
                <button className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:text-primary">Refuser et demander une correction</button>
              </form>
            </li>
          ))}
          {!pendingOpportunities?.length && <li className="text-sm text-muted">Aucune annonce à valider.</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Signalements ouverts ({reports?.length ?? 0})</h2>
        <ul className="mt-3 space-y-2">
          {reports?.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
              <div>
                <p className="font-medium">{r.reason}</p>
                <p className="text-xs text-muted">
                  {r.target_type} ·{" "}
                  <Link href={TARGET_HREF[r.target_type](r.target_id)} className="text-primary">
                    voir
                  </Link>{" "}
                  · par @{(r.reporter as unknown as { username: string }).username} · {timeAgo(r.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={moderate.bind(null, r.id, "remove")}>
                  <button className="rounded-full bg-primary px-3 py-1 text-xs text-primary-ink">Supprimer (-15 XP)</button>
                </form>
                <form action={moderate.bind(null, r.id, "dismiss")}>
                  <button className="rounded-full border border-border px-3 py-1 text-xs">Classer</button>
                </form>
              </div>
            </li>
          ))}
          {!reports?.length && <li className="text-sm text-muted">File vide.</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Litiges de la Micro-Bourse</h2>
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
          {!disputes?.length && <li className="text-sm text-muted">Aucun litige.</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Sources du Radar (flux RSS ou Atom d&apos;appels d&apos;offres)</h2>
        <p className="text-xs text-muted">Collectées chaque jour : seules les annonces liées au numérique sont retenues.</p>
        <ul className="mt-3 space-y-2">
          {sources?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{s.name}</span> {s.country && <span className="text-muted">· {s.country}</span>}
                <span className="block truncate font-mono text-xs text-muted">{s.url}</span>
                <span className="text-xs text-muted">{s.last_fetched_at ? `collectée ${timeAgo(s.last_fetched_at)}` : "jamais collectée"}</span>
              </span>
              <form action={toggleRadarSource.bind(null, s.id, !s.active)}>
                <button className="rounded-full border border-border px-3 py-1 text-xs">{s.active ? "Désactiver" : "Activer"}</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addRadarSource} className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]">
          <input name="name" required placeholder="Nom de la source" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <input name="url" type="url" required placeholder="https://…/flux.rss" className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm" />
          <input name="country" placeholder="Pays" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <button className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink">Ajouter</button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Centrale d&apos;achat : ristourne annuelle</h2>
        <p className="text-xs text-muted">20 % de la marge de l&apos;année, reversés en crédits au prorata de la consommation de chaque membre. Une seule fois par an.</p>
        <form action={distributeRebate} className="mt-2 flex gap-2">
          <input name="year" type="number" defaultValue={new Date().getFullYear() - 1} className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <button className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink">Verser la ristourne</button>
        </form>
      </section>
    </main>
  );
}
