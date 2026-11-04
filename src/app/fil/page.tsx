import Link from "next/link";
import { UserChip } from "@/components/Avatar";
import { requireSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { levelForXp } from "@/lib/levels";

export const metadata = { title: "Mon fil · Baobab Dev" };

// Fil personnalisé (§5.2) : questions dans mes technologies, projets de mon pays,
// Squads qui cherchent mon profil, tickets qui correspondent à mes compétences.
export default async function FeedPage() {
  const { supabase, user } = await requireSession("/fil");

  const [{ data: me }, { data: mySkills }] = await Promise.all([
    supabase.from("profiles").select("username, full_name, country, xp").eq("id", user.id).single(),
    supabase.rpc("my_skill_names"),
  ]);
  const skills = (mySkills ?? []) as string[];

  const [{ data: questions }, { data: projects }, { data: squads }, { data: bounties }] = await Promise.all([
    supabase.rpc("feed_questions", { p_limit: 6 }) as unknown as Promise<{
      data: { id: string; title: string; tags: string[]; answers_count: number; accepted_answer_id: string | null; created_at: string }[] | null;
    }>,
    supabase
      .from("projects")
      .select("name, slug, description, owner:profiles!projects_owner_id_fkey!inner(username, full_name, avatar_url, city, country)")
      .eq("owner.country", me?.country ?? "")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("squads")
      .select("id, name, skills_needed, roles_needed")
      .eq("status", "recruiting")
      .neq("owner_id", user.id)
      .limit(20),
    supabase
      .from("bounties")
      .select("id, title, total_amount, deadline")
      .in("status", ["open", "reserved"])
      .neq("creator_id", user.id)
      .order("total_amount", { ascending: false })
      .limit(5),
  ]);

  const nowIso = new Date().toISOString();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, title, ends_at")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("ends_at")
    .limit(1)
    .maybeSingle();
  const matchingSquads = (squads ?? []).filter((s) => s.skills_needed.some((k: string) => skills.includes(k.toLowerCase())));
  const lvl = levelForXp(me?.xp ?? 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Bonjour {me?.full_name?.split(" ")[0] ?? me?.username} 👋</h1>
      <p className="text-muted">
        {lvl.name} · {me?.xp} XP{lvl.next && ` · encore ${lvl.next.floor - (me?.xp ?? 0)} XP pour ${lvl.next.name}`}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Questions dans tes technologies</h2>
              <Link href="/questions" className="text-sm text-primary">
                Tout voir
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
              {questions?.length ? (
                questions.map((q) => (
                  <li key={q.id} className="px-4 py-3">
                    <Link href={`/questions/${q.id}`} className="font-medium hover:text-primary">
                      {q.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {q.tags.join(" · ")} · {q.answers_count} réponse(s){q.accepted_answer_id ? " · résolue" : ""} · {timeAgo(q.created_at)}
                    </p>
                  </li>
                ))
              ) : (
                <li className="px-4 py-4 text-sm text-muted">
                  Ajoute tes technologies dans <Link href="/parametres" className="text-primary">tes paramètres</Link> pour personnaliser ton fil.
                </li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="font-semibold">Projets de ton pays</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {projects?.map((p) => (
                <li key={p.slug} className="rounded-xl border border-border bg-surface p-4">
                  <Link href={`/showroom/${p.slug}`} className="font-medium hover:text-primary">
                    {p.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>
                  <div className="mt-2">
                    <UserChip user={p.owner as never} />
                  </div>
                </li>
              ))}
              {!projects?.length && <li className="text-sm text-muted">Aucun projet de ton pays pour l&apos;instant.</li>}
            </ul>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="rounded-xl border border-gold bg-surface p-4">
            <h2 className="font-semibold">Tickets payés pour toi</h2>
            <ul className="mt-3 space-y-3">
              {bounties?.map((b) => (
                <li key={b.id}>
                  <Link href={`/bourse/${b.id}`} className="block text-sm hover:text-primary">
                    {b.title}
                  </Link>
                  <span className="font-mono text-sm font-semibold text-gold">{fcfa(b.total_amount)}</span>
                </li>
              ))}
              {!bounties?.length && <li className="text-sm text-muted">Aucun ticket ouvert.</li>}
            </ul>
          </section>

          <section>
            <h2 className="font-semibold">Squads qui cherchent ton profil</h2>
            <ul className="mt-3 space-y-2">
              {matchingSquads.map((s) => (
                <li key={s.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                  <Link href={`/squads/${s.id}`} className="font-medium hover:text-primary">
                    {s.name}
                  </Link>
                  <p className="text-xs text-muted">{s.roles_needed.join(", ")}</p>
                </li>
              ))}
              {!matchingSquads.length && <li className="text-sm text-muted">Aucune pour l&apos;instant.</li>}
            </ul>
          </section>

          <section className="rounded-xl border border-primary bg-surface p-4 text-sm">
            <h2 className="font-semibold">Défi de la semaine</h2>
            {challenge ? (
              <>
                <Link href={`/defis/${challenge.id}`} className="mt-1 block hover:text-primary">
                  {challenge.title}
                </Link>
                <p className="text-xs text-muted">Se termine {timeAgo(challenge.ends_at)} · jusqu&apos;à +100 XP</p>
              </>
            ) : (
              <p className="mt-1 text-muted">Le prochain défi arrive bientôt.</p>
            )}
          </section>

          <Link href="/griot" className="block rounded-xl bg-leaf p-4 text-background">
            <span className="font-semibold">Bloqué·e ? Demande au Griot</span>
            <span className="block text-sm opacity-90">Il répond avec les réponses validées de la communauté.</span>
          </Link>
        </aside>
      </div>
    </main>
  );
}
