import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { plainText } from "@/lib/format";
import { UserChip } from "@/components/Avatar";
import { PROJECT_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  return { title: await pageTitle("Showroom · Baobab Dev") };
}

export default async function ShowroomPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, description, stack, status, likes_count, looking_for_contributors, project_of_week_at, owner:profiles!projects_owner_id_fkey(username, full_name, avatar_url, city)")
    .or("abandon_status.is.null,abandon_status.in.(revival,adopted)")
    .order("project_of_week_at", { ascending: false, nullsFirst: false })
    .order("likes_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(48);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-leaf/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-leaf uppercase">
              {t("Vitrine Panafricaine")}
            </span>
            <span className="text-xs text-muted">{projects?.length ?? 0}{" "}{t("projets")}</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl tracking-tight">{t("Showroom des projets")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("Découvre ce que les développeurs du continent construisent, inspire-toi et rejoins des équipes.")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/showroom/relancer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/70 px-4 py-2 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-surface"
          >
            <span>{t("Projets à relancer")}</span>
            <span className="text-primary font-bold">↻</span>
          </Link>
          <Link
            href="/showroom/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-ink shadow-md shadow-primary/20 transition hover:opacity-95 hover:shadow-lg sm:text-sm"
          >
            <span>{t("+ Publier un projet")}</span>
          </Link>
        </div>
      </div>

      {/* Grille de projets */}
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => {
          const isFeatured = Boolean(p.project_of_week_at);
          return (
            <li
              key={p.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-surface/85 p-6 transition duration-300 hover:shadow-xl ${
                isFeatured
                  ? "border-gold/60 shadow-lg shadow-gold/5"
                  : "border-border/80 hover:border-primary/50"
              }`}
            >
              {isFeatured && (
                <div className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full bg-gold/15 px-3 py-1 font-mono text-[11px] font-bold text-gold uppercase tracking-wider">
                  <span>★</span>
                  <span>{t("Projet de la semaine")}</span>
                </div>
              )}

              <div>
                <Link
                  href={`/showroom/${p.slug}`}
                  className="block font-bold text-lg text-foreground transition group-hover:text-primary leading-snug"
                >
                  {p.name}
                </Link>

                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted sm:text-sm">
                  {plainText(p.description)}
                </p>

                {/* Stack tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.stack.map((s: string) => (
                    <span
                      key={s}
                      className="rounded-lg border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[11px] font-medium text-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-border/50 pt-4">
                <div className="flex items-center justify-between text-sm">
                  {p.owner && <UserChip user={p.owner as never} />}
                  <span className="flex items-center gap-1 font-mono text-xs font-semibold text-rose-500">
                    <span aria-hidden="true">♥</span>
                    <span>{p.likes_count}</span>
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-border/80 bg-background/50 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                    {PROJECT_STATUS[p.status]}
                  </span>
                  {p.looking_for_contributors && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-leaf/15 px-2.5 py-0.5 text-[11px] font-bold text-leaf">
                      <span className="h-1.5 w-1.5 rounded-full bg-leaf animate-pulse" />
                      {t("Cherche collaborateurs")}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
