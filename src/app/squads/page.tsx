import Link from "next/link";
import { UserChip } from "@/components/Avatar";
import { SQUAD_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Squads · Baobab Dev" };

export default async function SquadsPage() {
  const supabase = await createClient();
  const { data: squads } = await supabase
    .from("squads")
    .select("id, name, description, roles_needed, skills_needed, duration_weeks, commitment, status, owner:profiles!squads_owner_id_fkey(username, full_name, avatar_url, city), squad_members(status)")
    .order("status")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Squads</h1>
          <p className="text-muted">Des équipes formées par compétences, disponibilité et fuseau horaire.</p>
        </div>
        <Link href="/squads/new" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
          Monter une Squad
        </Link>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {squads?.map((s) => {
          const members = s.squad_members.filter((m: { status: string }) => m.status === "member").length + 1;
          return (
            <li className="group rounded-2xl border border-border/80 bg-surface p-5 shadow-sm motion-safe:transition motion-safe:duration-200 motion-reduce:transition-none motion-safe:hover:-translate-y-1 motion-safe:hover:border-primary/40 motion-safe:hover:shadow-xl motion-safe:hover:shadow-primary/5" key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <Link href={`/squads/${s.id}`} className="text-lg font-semibold transition-colors group-hover:text-primary">
                  {s.name}
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${s.status === "recruiting" ? "bg-leaf/10 text-leaf" : "border border-border text-muted"}`}
                >
                  {SQUAD_STATUS[s.status]}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</p>
              {s.roles_needed.length > 0 && (
                <p className="mt-3 text-sm">
                  <span className="text-muted">Recherche : </span>
                  {s.roles_needed.join(", ")}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.skills_needed.map((k: string) => (
                  <span key={k} className="rounded bg-background px-2 py-0.5 font-mono text-xs">
                    {k}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                {s.owner && <UserChip user={s.owner as never} />}
                <span>
                  {members} membre{members > 1 ? "s" : ""}
                  {s.duration_weeks && ` · ${s.duration_weeks} sem.`}
                  {s.commitment && ` · ${s.commitment}`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
