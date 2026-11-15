import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { UserChip } from "@/components/Avatar";
import { SQUAD_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  return { title: await pageTitle("Squads · Baobab Dev") };
}

export default async function SquadsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: squads } = await supabase
    .from("squads")
    .select("id, name, description, roles_needed, skills_needed, duration_weeks, commitment, status, owner:profiles!squads_owner_id_fkey(username, full_name, avatar_url, city), squad_members(status)")
    .order("status")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary uppercase">
              {t("Collaboration active")}
            </span>
            <span className="text-xs text-muted">{squads?.length ?? 0}{" "}{t("Squads")}</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl tracking-tight">{t("Squads de développement")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("Équipes montées par affinités techniques, compétences complémentaires et fuseau horaire.")}
          </p>
        </div>

        <Link
          href="/squads/new"
          className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-ink shadow-md shadow-primary/20 transition hover:opacity-95 hover:shadow-lg sm:text-sm"
        >
          <span>{t("+ Monter une Squad")}</span>
        </Link>
      </div>

      {/* Grille des Squads */}
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {squads?.map((s) => {
          const members = s.squad_members.filter((m: { status: string }) => m.status === "member").length + 1;
          const isRecruiting = s.status === "recruiting";

          return (
            <li
              key={s.id}
              className={`group flex flex-col justify-between rounded-3xl border bg-surface/85 p-6 transition duration-300 hover:shadow-xl ${
                isRecruiting
                  ? "border-leaf/40 hover:border-leaf/80 shadow-xs"
                  : "border-border/80 hover:border-primary/50"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/squads/${s.id}`}
                    className="font-bold text-xl text-foreground transition group-hover:text-primary leading-tight"
                  >
                    {s.name}
                  </Link>

                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isRecruiting
                        ? "bg-leaf/15 text-leaf border border-leaf/30"
                        : "border border-border/80 bg-background/60 text-muted"
                    }`}
                  >
                    {isRecruiting && <span className="h-1.5 w-1.5 rounded-full bg-leaf animate-pulse" />}
                    {SQUAD_STATUS[s.status]}
                  </span>
                </div>

                <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">
                  {s.description}
                </p>

                {s.roles_needed.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-3 text-xs">
                    <span className="font-semibold text-primary">{t("Rôles recherchés :")}{" "}</span>
                    <span className="text-foreground">{s.roles_needed.join(" · ")}</span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {s.skills_needed.map((k: string) => (
                    <span
                      key={k}
                      className="rounded-lg border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[11px] font-medium text-muted"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4 text-xs text-muted">
                {s.owner && <UserChip user={s.owner as never} />}

                <div className="flex items-center gap-2 font-medium">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary font-mono font-semibold">
                    👥 {members}{" "}{t("membre")}{members > 1 ? "s" : ""}
                  </span>
                  {s.duration_weeks && <span>· {s.duration_weeks}{" "}{t("sem.")}</span>}
                  {s.commitment && <span>· {s.commitment}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
