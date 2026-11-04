import Link from "next/link";
import { notFound } from "next/navigation";
import { UserChip } from "@/components/Avatar";
import { ReportButton } from "@/components/ReportButton";
import { getSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/labels";
import { commentProject, electProjectOfWeek, toggleLike } from "../actions";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user, profile } = await getSession();

  const { data: project } = await supabase
    .from("projects")
    .select("*, owner:profiles!projects_owner_id_fkey(username, full_name, avatar_url, city), squad:squads!projects_squad_fk(id, name, status)")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: liked }, { data: comments }] = await Promise.all([
    user
      ? supabase.from("project_likes").select("project_id").eq("project_id", project.id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("comments")
      .select("id, body, created_at, author:profiles!comments_author_id_fkey(username, full_name, avatar_url)")
      .eq("target_type", "project")
      .eq("target_id", project.id)
      .order("created_at"),
  ]);
  const isModerator = profile && ["moderator", "admin"].includes(profile.role);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/showroom" className="text-sm text-muted hover:text-primary">
        ← Showroom
      </Link>
      {project.project_of_week_at && <p className="mt-3 text-xs font-semibold uppercase text-gold">Projet de la semaine</p>}
      <h1 className="mt-1 text-3xl font-bold">{project.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <UserChip user={project.owner} />
        <span className="rounded-full border border-border px-2 py-0.5 text-xs">{PROJECT_STATUS[project.status]}</span>
      </div>

      <p className="mt-6 text-lg">{project.description}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {project.stack.map((s: string) => (
          <span key={s} className="rounded bg-surface px-2 py-0.5 font-mono text-xs">
            {s}
          </span>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <form action={toggleLike.bind(null, project.id, slug)}>
          <button
            disabled={!user}
            className={`rounded-full border px-4 py-2 text-sm ${liked ? "border-primary bg-primary text-primary-ink" : "border-border"}`}
          >
            ♥ {project.likes_count}
          </button>
        </form>
        {project.demo_url && (
          <a href={project.demo_url} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">
            Voir la démo
          </a>
        )}
        {project.repo_url && (
          <a href={project.repo_url} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">
            Dépôt
          </a>
        )}
        {isModerator && !project.project_of_week_at && (
          <form action={electProjectOfWeek.bind(null, project.id, slug)}>
            <button className="rounded-full border border-gold px-4 py-2 text-sm text-gold">Élire projet de la semaine</button>
          </form>
        )}
      </div>

      {project.squad && (
        <Link
          href={`/squads/${project.squad.id}`}
          className="mt-6 block rounded-xl border border-leaf bg-leaf/5 p-4 hover:bg-leaf/10"
        >
          <span className="font-medium text-leaf">
            {project.squad.status === "recruiting" ? "Ce projet cherche des contributeurs" : "L'équipe du projet"}
          </span>
          <span className="block text-sm text-muted">{project.squad.name} →</span>
        </Link>
      )}

      <section className="mt-10">
        <h2 className="font-semibold">Commentaires et suggestions</h2>
        <ul className="mt-3 space-y-3">
          {(comments ?? []).map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <p>{c.body}</p>
              <div className="mt-2 text-xs text-muted">
                <UserChip user={c.author as never} /> · {timeAgo(c.created_at)}
              </div>
            </li>
          ))}
        </ul>
        {user && (
          <form action={commentProject.bind(null, project.id, slug)} className="mt-3 flex gap-2">
            <input name="body" required placeholder="Une suggestion ?" className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            <button className="rounded-lg border border-border px-4 text-sm">Envoyer</button>
          </form>
        )}
        <div className="mt-4 text-right">
          <ReportButton targetType="project" targetId={project.id} path={`/showroom/${slug}`} />
        </div>
      </section>
    </main>
  );
}
