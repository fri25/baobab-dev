import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Modération · Baobab Dev" };

const TARGET_HREF: Record<string, (id: string) => string> = {
  question: (id) => `/questions/${id}`,
  answer: () => "/questions",
  project: () => "/showroom",
  comment: () => "/questions",
  profile: () => "/classements",
  griot_query: () => "/griot",
  message: () => "/discussions?onglet=sujets",
};

async function moderate(reportId: number, action: "remove" | "dismiss") {
  "use server";
  const { supabase } = await requireSession("/moderation");
  await supabase.rpc("moderate_report", { p_report_id: reportId, p_action: action });
  revalidatePath("/moderation");
}

export default async function ModerationPage() {
  const { supabase, profile } = await requireSession("/moderation");
  if (!["moderator", "admin"].includes(profile.role)) notFound();

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
      <h1 className="text-2xl font-bold">Modération et administration</h1>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s, i) => (
          <div key={labels[i]} className="rounded-xl border border-border bg-surface p-3">
            <p className="font-mono text-2xl font-bold">{s.count ?? "—"}</p>
            <p className="text-xs text-muted">{labels[i]}</p>
          </div>
        ))}
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
    </main>
  );
}
