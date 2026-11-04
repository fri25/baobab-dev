import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, UserChip } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { SQUAD_STATUS } from "@/lib/labels";
import { levelForXp } from "@/lib/levels";
import {
  acceptInvite,
  addTask,
  applyToSquad,
  inviteToSquad,
  moveTask,
  setMemberStatus,
  setSquadStatus,
} from "../actions";
import { SquadChat } from "./SquadChat";

type Member = {
  user_id: string;
  role: string | null;
  status: string;
  profile: { username: string; full_name: string | null; avatar_url: string | null; city: string | null; xp: number };
};

type Candidate = {
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  xp: number;
  availability: string;
  matched_skills: string[];
};

const COLUMNS = [
  { status: "todo", label: "À faire" },
  { status: "doing", label: "En cours" },
  { status: "done", label: "Fait" },
] as const;

export default async function SquadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getSession();

  const { data: squad } = await supabase
    .from("squads")
    .select("*, owner:profiles!squads_owner_id_fkey(username, full_name, avatar_url, city), project:projects!squads_project_id_fkey(name, slug, repo_url)")
    .eq("id", id)
    .maybeSingle();
  if (!squad) notFound();

  const { data: rawMembers } = await supabase
    .from("squad_members")
    .select("user_id, role, status, profile:profiles!squad_members_user_id_fkey(username, full_name, avatar_url, city, xp)")
    .eq("squad_id", id);
  const members = (rawMembers ?? []) as unknown as Member[];

  const isOwner = user?.id === squad.owner_id;
  const me = members.find((m) => m.user_id === user?.id);
  const isMember = isOwner || me?.status === "member";

  const [{ data: tasks }, { data: messages }, { data: candidates }] = await Promise.all([
    isMember ? supabase.from("tasks").select("*").eq("squad_id", id).order("position") : Promise.resolve({ data: [] }),
    isMember
      ? supabase.from("squad_messages").select("id, author_id, body, created_at").eq("squad_id", id).order("created_at").limit(100)
      : Promise.resolve({ data: [] }),
    isOwner && squad.status !== "completed"
      ? supabase.rpc("match_squad_candidates", { p_squad_id: id, match_count: 6 })
      : Promise.resolve({ data: [] }),
  ]);

  const active = members.filter((m) => m.status === "member");
  const pending = members.filter((m) => m.status === "applied");
  const names: Record<string, string> = { [squad.owner_id]: squad.owner.full_name ?? squad.owner.username };
  for (const m of members) names[m.user_id] = m.profile.full_name ?? m.profile.username;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/squads" className="text-sm text-muted hover:text-primary">
        ← Squads
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{squad.name}</h1>
          {squad.project && (
            <Link href={`/showroom/${squad.project.slug}`} className="text-sm text-primary">
              Projet : {squad.project.name}
            </Link>
          )}
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-sm">{SQUAD_STATUS[squad.status]}</span>
      </div>
      <p className="mt-4 max-w-3xl">{squad.description}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
        {squad.roles_needed.length > 0 && <span>Rôles : {squad.roles_needed.join(", ")}</span>}
        {squad.duration_weeks && <span>Durée : {squad.duration_weeks} semaines</span>}
        {squad.commitment && <span>Engagement : {squad.commitment}</span>}
      </div>

      {/* Actions selon le rôle */}
      <div className="mt-6 flex flex-wrap gap-2">
        {user && !isOwner && !me && squad.status === "recruiting" && (
          <form action={applyToSquad.bind(null, id)} className="flex gap-2">
            <select name="role" className="rounded-full border border-border bg-surface px-3 text-sm">
              {squad.roles_needed.map((r: string) => (
                <option key={r}>{r}</option>
              ))}
              <option value="">Autre</option>
            </select>
            <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">Postuler</button>
          </form>
        )}
        {me?.status === "applied" && <span className="rounded-full border border-border px-4 py-2 text-sm">Candidature envoyée</span>}
        {me?.status === "invited" && (
          <form action={acceptInvite.bind(null, id)}>
            <button className="rounded-full bg-leaf px-5 py-2 text-sm font-medium text-background">Accepter l&apos;invitation</button>
          </form>
        )}
        {me?.status === "member" && squad.status === "active" && (
          <form action={setMemberStatus.bind(null, id, user!.id, "left")}>
            <button className="rounded-full border border-border px-4 py-2 text-sm text-muted">Quitter (-20 XP)</button>
          </form>
        )}
        {isOwner && squad.status === "recruiting" && (
          <form action={setSquadStatus.bind(null, id, "active")}>
            <button className="rounded-full border border-border px-4 py-2 text-sm">Démarrer le projet</button>
          </form>
        )}
        {isOwner && squad.status === "active" && (
          <form action={setSquadStatus.bind(null, id, "completed")}>
            <button className="rounded-full bg-leaf px-4 py-2 text-sm font-medium text-background">
              Clôturer la Squad (+60 XP par membre)
            </button>
          </form>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {isMember ? (
            <>
              <section>
                <h2 className="mb-3 font-semibold">Tableau de tâches</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {COLUMNS.map((col) => (
                    <div key={col.status} className="rounded-xl border border-border bg-surface p-3">
                      <h3 className="mb-2 text-sm font-medium text-muted">{col.label}</h3>
                      <ul className="space-y-2">
                        {tasks
                          ?.filter((t) => t.status === col.status)
                          .map((t) => (
                            <li key={t.id} className="rounded-lg bg-background p-2 text-sm">
                              {t.title}
                              {t.assignee_id && <span className="block text-xs text-muted">{names[t.assignee_id]}</span>}
                              <div className="mt-1 flex gap-1">
                                {COLUMNS.filter((c) => c.status !== col.status).map((c) => (
                                  <form key={c.status} action={moveTask.bind(null, id, t.id, c.status)}>
                                    <button className="rounded border border-border px-1.5 text-xs text-muted hover:text-foreground">
                                      → {c.label}
                                    </button>
                                  </form>
                                ))}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <form action={addTask.bind(null, id)} className="mt-3 flex gap-2">
                  <input name="title" required placeholder="Nouvelle tâche" className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
                  <button className="rounded-lg border border-border px-4 text-sm">Ajouter</button>
                </form>
              </section>
              <section>
                <h2 className="mb-3 font-semibold">Discussion</h2>
                <SquadChat squadId={id} initial={messages ?? []} members={names} />
              </section>
              {squad.project?.repo_url && (
                <a href={squad.project.repo_url} className="text-sm text-primary">
                  Dépôt du projet →
                </a>
              )}
            </>
          ) : (
            <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
              Les tâches et la discussion sont réservées aux membres de la Squad.
            </p>
          )}
        </div>

        <aside className="space-y-8">
          <section>
            <h2 className="mb-3 font-semibold">Équipe</h2>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <UserChip user={squad.owner} />
                <span className="text-xs text-muted">porteur</span>
              </li>
              {active.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2 text-sm">
                  <UserChip user={m.profile} />
                  {m.role && <span className="text-xs text-muted">{m.role}</span>}
                </li>
              ))}
            </ul>
          </section>

          {isOwner && pending.length > 0 && (
            <section>
              <h2 className="mb-3 font-semibold">Candidatures</h2>
              <ul className="space-y-2">
                {pending.map((m) => (
                  <li key={m.user_id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                    <UserChip user={m.profile} />
                    <p className="text-xs text-muted">
                      {m.role ?? "Rôle libre"} · {levelForXp(m.profile.xp).name}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <form action={setMemberStatus.bind(null, id, m.user_id, "member")}>
                        <button className="rounded bg-leaf px-3 py-1 text-xs text-background">Accepter</button>
                      </form>
                      <form action={setMemberStatus.bind(null, id, m.user_id, "rejected")}>
                        <button className="rounded border border-border px-3 py-1 text-xs">Refuser</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isOwner && (candidates as Candidate[] | null)?.length ? (
            <section>
              <h2 className="mb-1 font-semibold">Profils suggérés</h2>
              <p className="mb-3 text-xs text-muted">Classés par compétences, disponibilité et réputation.</p>
              <ul className="space-y-2">
                {(candidates as Candidate[]).map((c) => (
                  <li key={c.user_id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                    <Avatar user={c} size={36} />
                    <div className="min-w-0 flex-1 text-sm">
                      <Link href={`/u/${c.username}`} className="font-medium hover:text-primary">
                        {c.full_name ?? c.username}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {[c.city, c.country].filter(Boolean).join(", ")} · {levelForXp(c.xp).name}
                      </p>
                      <p className="truncate font-mono text-xs text-leaf">{c.matched_skills.join(" · ")}</p>
                    </div>
                    <form action={inviteToSquad.bind(null, id, c.user_id)}>
                      <button className="rounded-full border border-primary px-3 py-1 text-xs text-primary">Inviter</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
