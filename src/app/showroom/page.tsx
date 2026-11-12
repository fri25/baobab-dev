import Link from "next/link";
import { UserChip } from "@/components/Avatar";
import { PROJECT_STATUS } from "@/lib/labels";
import { markdownSummary } from "@/lib/markdown";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Showroom · Baobab Dev" };

export default async function ShowroomPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, description, stack, status, likes_count, looking_for_contributors, project_of_week_at, owner:profiles!projects_owner_id_fkey(username, full_name, avatar_url, city, xp)")
    .or("abandon_status.is.null,abandon_status.in.(revival,adopted)")
    .order("project_of_week_at", { ascending: false, nullsFirst: false })
    .order("likes_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(48);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Showroom</h1>
          <p className="text-muted">Ce que les devs africains construisent.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/showroom/relancer" className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">
            Projets à relancer
          </Link>
          <Link href="/showroom/new" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
            Publier un projet
          </Link>
        </div>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => (
          <li
            key={p.id}
            className={`group flex flex-col rounded-2xl border bg-surface p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
              p.project_of_week_at ? "border-gold/60 shadow-gold/5" : "border-border hover:border-primary/40"
            }`}
          >
            {p.project_of_week_at && (
              <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold">
                ✦ Projet de la semaine
              </span>
            )}
            <Link href={`/showroom/${p.slug}`} className="text-lg font-semibold leading-snug group-hover:text-primary">
              {p.name}
            </Link>
            <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">{markdownSummary(p.description)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.stack.map((s: string) => (
                <span key={s} className="rounded-full bg-tech/10 px-2.5 py-1 font-mono text-xs text-tech">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              {p.owner && <UserChip user={p.owner as never} />}
              <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted" aria-label={`${p.likes_count} mentions j'aime`}>
                ♥ {p.likes_count}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border px-2.5 py-1 text-muted">{PROJECT_STATUS[p.status]}</span>
              {p.looking_for_contributors && (
                <span className="rounded-full bg-leaf/10 px-2.5 py-1 font-medium text-leaf">Cherche des collaborateurs</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
