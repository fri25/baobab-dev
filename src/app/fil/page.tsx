import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { CodePreview, firstCodeBlock } from "@/components/CodePreview";
import { requireSession } from "@/lib/auth";
import { fcfa, plainText, timeAgo } from "@/lib/format";
import { getT, pageTitle } from "@/lib/i18n/server";
import { levelForXp } from "@/lib/levels";

export async function generateMetadata() {
  return { title: await pageTitle("Mon fil · Baobab Dev") };
}

type Props = { searchParams: Promise<{ tag?: string; flux?: string; tri?: string }> };

type Author = { username: string; full_name: string | null; avatar_url: string | null; city: string | null; country: string | null; xp: number };
type FeedQuestion = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  answers_count: number;
  accepted_answer_id: string | null;
  created_at: string;
  author: Author | null;
};

const SORTS = ["recentes", "sans-reponse", "populaires"] as const;
const SORT_LABEL: Record<(typeof SORTS)[number], string> = {
  recentes: "Les plus récentes",
  "sans-reponse": "Sans réponse",
  populaires: "Les plus discutées",
};
const QUESTION_FIELDS =
  "id, title, body, tags, answers_count, accepted_answer_id, created_at, author:profiles!questions_author_id_fkey(username, full_name, avatar_url, city, country, xp)";

// Fil personnalisé (§5.2) : au centre les questions (dans mes technologies par défaut),
// à droite les Squads qui recrutent, le top réputation de la semaine, le défi en cours et les tickets payés.
export default async function FeedPage({ searchParams }: Props) {
  const t = await getT();
  const { supabase, user } = await requireSession("/fil");
  const { tag, flux, tri } = await searchParams;
  const sort = SORTS.includes(tri as (typeof SORTS)[number]) ? (tri as (typeof SORTS)[number]) : "recentes";

  const [{ data: me }, { data: mySkills }, { data: recentTags }] = await Promise.all([
    supabase.from("profiles").select("username, full_name").eq("id", user.id).single(),
    supabase.rpc("my_skill_names"),
    supabase.from("questions").select("tags").order("created_at", { ascending: false }).limit(60),
  ]);
  const skills = ((mySkills ?? []) as string[]).map((s) => s.toLowerCase());

  // Filtres : mes technologies d'abord, puis les tags les plus fréquents
  const tagCount = new Map<string, number>();
  for (const row of recentTags ?? []) for (const tg of row.tags as string[]) tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1);
  const chips = [...tagCount.entries()]
    .sort((a, b) => Number(skills.includes(b[0].toLowerCase())) - Number(skills.includes(a[0].toLowerCase())) || b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);

  // Questions du fil
  let query = supabase.from("questions").select(QUESTION_FIELDS).limit(15);
  let forYouEmpty = false;
  if (tag) query = query.contains("tags", [tag]);
  else if (flux !== "tout") {
    const { data: mine } = await supabase.rpc("feed_questions", { p_limit: 30 });
    const ids = ((mine ?? []) as { id: string }[]).map((q) => q.id);
    if (ids.length) query = query.in("id", ids);
    else forYouEmpty = true; // rien dans mes technologies : on montre tout
  }
  if (sort === "sans-reponse") query = query.order("answers_count").order("created_at", { ascending: false });
  else if (sort === "populaires") query = query.order("answers_count", { ascending: false }).order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const nowIso = new Date().toISOString();
  const [{ data: questions }, { data: squads }, { data: points }, { data: challenge }, { data: bounties }] = await Promise.all([
    query as unknown as Promise<{ data: FeedQuestion[] | null }>,
    supabase.from("squads").select("id, name, skills_needed, squad_members(count)").eq("status", "recruiting").limit(20),
    supabase
      .from("points_log")
      .select("user_id, amount, profile:profiles!points_log_user_id_fkey(username, full_name, avatar_url)")
      .gte("created_at", weekAgo)
      .gt("amount", 0)
      .limit(2000),
    supabase.from("challenges").select("id, title, ends_at, grading").lte("starts_at", nowIso).gt("ends_at", nowIso).order("ends_at").limit(1).maybeSingle(),
    supabase
      .from("bounties")
      .select("id, title, total_amount, deadline")
      .in("status", ["open", "reserved"])
      .neq("creator_id", user.id)
      .order("total_amount", { ascending: false })
      .limit(3),
  ]);

  // Squads les plus fournies qui recrutent
  const popularSquads = (squads ?? [])
    .map((s) => ({ ...s, members: (s.squad_members as unknown as { count: number }[])[0]?.count ?? 0 }))
    .sort((a, b) => b.members - a.members)
    .slice(0, 3);

  // Top réputation des 7 derniers jours
  const totals = new Map<string, { total: number; gains: number; profile: { username: string; full_name: string | null; avatar_url: string | null } }>();
  for (const row of points ?? []) {
    const profile = row.profile as unknown as { username: string; full_name: string | null; avatar_url: string | null } | null;
    if (!profile) continue;
    const entry = totals.get(row.user_id) ?? { total: 0, gains: 0, profile };
    entry.total += row.amount;
    entry.gains += 1;
    totals.set(row.user_id, entry);
  }
  const topWeek = [...totals.values()].sort((a, b) => b.total - a.total).slice(0, 3);

  const chipClass = (active: boolean) =>
    `inline-flex items-center rounded-lg border px-3 py-1.5 text-sm transition ${
      active ? "border-primary bg-primary text-primary-ink font-semibold" : "border-border bg-surface text-muted hover:text-foreground"
    }`;
  const href = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/fil?${s}` : "/fil";
  };
  const firstName = me?.full_name?.split(" ")[0] ?? me?.username;

  return (
    <div className="mx-auto flex w-full max-w-[90rem] gap-6 px-4 py-6 sm:px-6">
      {/* Fil */}
      <main className="min-w-0 flex-1">
        <h1 className="sr-only">{t("Mon fil")}</h1>
        <p className="text-sm text-muted">
          {t("Bonjour,")} <span className="font-semibold text-foreground">{firstName}</span>.{" "}
          {t("Voici ce qui se passe aujourd'hui dans tes technologies et dans ton écosystème.")}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <nav aria-label={t("Filtrer le fil")} className="flex flex-wrap gap-2">
            <Link href={href({ tri: tri })} className={chipClass(!tag && flux !== "tout")}>
              {t("Pour toi")}
            </Link>
            <Link href={href({ flux: "tout", tri })} className={chipClass(!tag && flux === "tout")}>
              {t("Toutes")}
            </Link>
            {chips.map((c) => (
              <Link key={c} href={href({ tag: c, tri })} className={chipClass(tag === c)}>
                {c}
              </Link>
            ))}
          </nav>
          <nav aria-label={t("Trier")} className="flex items-center gap-1 font-mono text-xs text-muted">
            <span>{t("Trier par :")}</span>
            {SORTS.map((s) => (
              <Link key={s} href={href({ tag, flux, tri: s === "recentes" ? undefined : s })} className={`rounded px-1.5 py-0.5 ${sort === s ? "font-semibold text-primary" : "hover:text-foreground"}`}>
                {t(SORT_LABEL[s])}
              </Link>
            ))}
          </nav>
        </div>

        {forYouEmpty && (
          <p className="mt-4 rounded-lg border border-border p-3 text-sm text-muted">
            {t("Aucune question récente dans tes technologies sélectionnées.")}{" "}
            <Link href="/parametres" className="text-primary hover:underline">
              {t("Personnaliser mes compétences dans les paramètres →")}
            </Link>
          </p>
        )}

        <ul className="mt-5 space-y-5">
          {(questions ?? []).map((q) => {
            const code = firstCodeBlock(q.body);
            const excerpt = plainText(q.body).slice(0, 280);
            const author = q.author;
            return (
              <li key={q.id}>
                <article className="rounded-xl border border-border bg-surface">
                  <div className="p-5">
                    <header className="flex items-start justify-between gap-3">
                      {author && (
                        <div className="flex min-w-0 items-center gap-3">
                          <Link href={`/u/${author.username}`}>
                            <Avatar user={author} size={40} />
                          </Link>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                              <Link href={`/u/${author.username}`} className="font-bold hover:text-primary">
                                {author.full_name ?? author.username}
                              </Link>
                              <span className="font-mono text-xs text-muted">
                                @{author.username} · {timeAgo(q.created_at)}
                              </span>
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span className="rounded border border-gold/40 px-1.5 py-0.5 font-mono text-[11px] text-gold">{levelForXp(author.xp).name}</span>
                              {[author.city, author.country].filter(Boolean).join(", ")}
                            </p>
                          </div>
                        </div>
                      )}
                      {q.tags[0] && (
                        <Link href={href({ tag: q.tags[0] })} className="shrink-0 rounded border border-primary/40 px-2 py-0.5 font-mono text-xs text-primary hover:bg-primary/10">
                          #{q.tags[0].toLowerCase()}
                        </Link>
                      )}
                    </header>

                    <h2 className="mt-4 text-lg font-bold leading-snug sm:text-xl">
                      <Link href={`/questions/${q.id}`} className="hover:text-primary">
                        {q.title}
                      </Link>
                    </h2>
                    {excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{excerpt}</p>}
                    {code && (
                      <div className="mt-4">
                        <CodePreview code={code.code} language={code.language} />
                      </div>
                    )}
                  </div>

                  <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3 text-sm text-muted">
                    <Link href={`/questions/${q.id}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                      </svg>
                      {q.answers_count} {q.answers_count > 1 ? t("réponses") : t("réponse")}
                    </Link>
                    {q.accepted_answer_id && <span className="font-semibold text-leaf">{t("✓ Résolue")}</span>}
                    {q.tags.slice(1, 4).map((tg) => (
                      <Link key={tg} href={href({ tag: tg })} className="font-mono text-xs hover:text-foreground">
                        #{tg.toLowerCase()}
                      </Link>
                    ))}
                    <Link href={`/questions/${q.id}`} className="ml-auto font-semibold text-primary hover:underline">
                      {t("Répondre")} →
                    </Link>
                  </footer>
                </article>
              </li>
            );
          })}
          {!questions?.length && <li className="rounded-xl border border-border p-6 text-center text-sm text-muted">{t("Aucune question trouvée.")}</li>}
        </ul>
      </main>

      {/* Colonne de droite */}
      <aside className="hidden w-80 shrink-0 space-y-5 xl:block">
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider">{t("Squads qui recrutent")}</h2>
            <Link href="/squads" className="text-xs text-primary hover:underline">
              {t("Voir tout")}
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {popularSquads.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border font-mono text-xs font-bold text-primary">
                  {s.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted">
                    {s.members > 0 && <>{t("{n} membre(s)", { n: s.members })} · </>}
                    {(s.skills_needed as string[]).slice(0, 3).join(", ")}
                  </p>
                </div>
                <Link href={`/squads/${s.id}`} className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:border-primary/50 hover:text-primary">
                  {t("Rejoindre")}
                </Link>
              </li>
            ))}
            {!popularSquads.length && <li className="text-xs text-muted">{t("Aucune Squad en recherche pour l'instant.")}</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider">{t("Top de la semaine")}</h2>
            <Link href="/classements" className="text-xs text-primary hover:underline">
              {t("Classements")}
            </Link>
          </div>
          <ol className="mt-3 space-y-2">
            {topWeek.map((row, i) => (
              <li key={row.profile.username} className={`flex items-center gap-3 rounded-lg px-2 py-2 ${i === 0 ? "border border-gold/40" : ""}`}>
                <span className={`w-4 text-center font-mono text-sm font-bold ${i === 0 ? "text-gold" : "text-muted"}`}>{i + 1}</span>
                <Avatar user={row.profile} size={32} />
                <Link href={`/u/${row.profile.username}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-primary">
                  @{row.profile.username}
                </Link>
                <span className="font-mono text-sm font-bold text-primary">+{row.total.toLocaleString()}</span>
              </li>
            ))}
            {!topWeek.length && <li className="text-xs text-muted">{t("Aucune activité pour l'instant.")}</li>}
          </ol>
        </section>

        {challenge ? (
          <section className="rounded-xl border border-gold/40 bg-gold/5 p-4">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-gold">{t("DÉFI HEBDO")}</h2>
            <p className="mt-2 text-sm font-semibold">{challenge.title}</p>
            <p className="mt-1 font-mono text-xs text-muted">
              {t("Se termine")} {timeAgo(challenge.ends_at)}
            </p>
            <Link href={`/defis/${challenge.id}`} className="mt-3 inline-block text-sm font-semibold text-gold hover:underline">
              {t("Participer au défi →")}
            </Link>
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider">{t("Tickets rémunérés")}</h2>
            <Link href="/bourse" className="text-xs text-primary hover:underline">
              {t("Bourse →")}
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {(bounties ?? []).map((b) => (
              <li key={b.id}>
                <Link href={`/bourse/${b.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-primary">
                  <span className="min-w-0 truncate">{b.title}</span>
                  <span className="shrink-0 font-mono text-xs font-bold text-gold">{fcfa(b.total_amount)}</span>
                </Link>
              </li>
            ))}
            {!bounties?.length && <li className="text-xs text-muted">{t("Aucun ticket ouvert actuellement.")}</li>}
          </ul>
        </section>
      </aside>
    </div>
  );
}
