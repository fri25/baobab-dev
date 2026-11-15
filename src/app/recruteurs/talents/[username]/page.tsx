import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { requireSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { levelForXp } from "@/lib/levels";
import { AVAILABILITY, CONTACT_STATUS, type Evidence, evidenceItems, OFFER_KIND, OPEN_TO } from "@/lib/recruiter-labels";
import { saveNote, sendContact, toggleShortlist } from "../../actions";

const input = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default async function TalentPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ error?: string; envoye?: string }>;
}) {
  const t = await getT();
  const { username } = await params;
  const { error, envoye } = await searchParams;
  const back = `/recruteurs/talents/${username}`;
  const { supabase, user } = await requireSession(back);

  const { data: p } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, bio, city, country, languages, xp, availability, open_to, github_username, recruiter_visible, role")
    .eq("username", username)
    .maybeSingle();
  if (!p || p.role !== "developer") notFound();

  // Journalise la consultation et vérifie l'abonnement
  const { data: ev, error: viewError } = await supabase.rpc("recruiter_view_profile", { p_dev: p.id });
  if (viewError) redirect(`/recruteurs?error=${encodeURIComponent(viewError.message)}`);
  const evidence = ev as Evidence;

  const [{ data: skills }, { data: projects }, { data: answers }, { data: shortlist }, { data: contacts }, { data: badges }] = await Promise.all([
    supabase.from("user_skills").select("source, weight, skills(name)").eq("user_id", p.id).order("weight", { ascending: false }),
    supabase.from("projects").select("name, slug, description, stack").eq("owner_id", p.id).limit(6),
    supabase
      .from("answers")
      .select("id, score, question:questions!answers_question_id_fkey(id, title)")
      .eq("author_id", p.id)
      .eq("is_accepted", true)
      .order("score", { ascending: false })
      .limit(5),
    supabase.from("recruiter_shortlist").select("note").eq("recruiter_id", user.id).eq("dev_id", p.id).maybeSingle(),
    supabase
      .from("recruiter_contacts")
      .select("id, title, offer_kind, status, created_at, conversation_id, decline_reason")
      .eq("recruiter_id", user.id)
      .eq("dev_id", p.id)
      .order("created_at", { ascending: false }),
    supabase.from("user_badges").select("badges(name, tier)").eq("user_id", p.id),
  ]);
  const pending = contacts?.find((c) => c.status === "pending");
  const level = levelForXp(p.xp);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/recruteurs" className="text-sm text-muted hover:text-primary">
        {t("← Recherche")}
      </Link>
      {error && <p className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {envoye && <p className="mt-3 rounded-lg bg-leaf/10 p-3 text-sm text-leaf">{t("Proposition envoyée. Le dev a 14 jours pour répondre.")}</p>}

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <Avatar user={p} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{p.full_name ?? p.username}</h1>
            {evidence.verified ? (
              <span className="rounded-full bg-leaf/15 px-2 py-0.5 text-xs font-medium text-leaf">{t("✓ Profil vérifié")}</span>
            ) : (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">{t("Non vérifié")}</span>
            )}
          </div>
          <p className="text-sm text-muted">
            @{p.username} · {[p.city, p.country].filter(Boolean).join(", ")} · {level.name} ({p.xp}{" "}{t("XP) ·")}{" "}{AVAILABILITY[p.availability ?? "available"]}
          </p>
          <p className="text-sm text-muted">{t("Langues :")}{" "}{p.languages.join(", ")}</p>
          {p.bio && <p className="mt-2 max-w-2xl">{p.bio}</p>}
          {p.open_to.length > 0 && (
            <p className="mt-2 text-sm text-primary">{t("Ouvert·e à :")}{" "}{p.open_to.map((o: string) => OPEN_TO.find((x) => x.value === o)?.label).join(", ")}</p>
          )}
        </div>
        <form action={toggleShortlist.bind(null, p.id, back)}>
          <button className={`rounded-full px-4 py-2 text-sm ${shortlist ? "bg-foreground text-background" : "border border-border"}`}>
            {shortlist ? t("★ Présélectionné·e") : t("☆ Présélectionner")}
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="font-semibold">{t("Preuves vérifiables")}</h2>
            <p className="text-xs text-muted">{t("Calculées à partir de l'activité sur Baobab Dev. Vérifié = GitHub relié et au moins deux autres familles de preuves.")}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {evidenceItems(evidence).map((e) => (
                <li key={e.label} className={`rounded-lg border px-3 py-2 text-sm ${e.ok ? "border-leaf/40 bg-leaf/5" : "border-border text-muted"}`}>
                  {e.ok ? "✓" : "·"} {e.ok ? e.label : e.label.replace(/^0 /, "Aucun·e ")}
                </li>
              ))}
            </ul>
            {p.github_username && (
              <a href={`https://github.com/${p.github_username}`} className="mt-2 inline-block text-sm text-primary">
                {t("github.com/")}{p.github_username} →
              </a>
            )}
          </section>

          <section>
            <h2 className="font-semibold">{t("Technologies")}</h2>
            <p className="mt-2 flex flex-wrap gap-1">
              {(skills ?? []).map((s) => {
                const name = (s.skills as unknown as { name: string }).name;
                return (
                  <span key={name} className="rounded bg-surface px-2 py-0.5 font-mono text-xs" title={s.source === "github" ? t("Détectée sur GitHub") : t("Déclarée")}>
                    {name}
                    {s.source === "github" && " ✓"}
                  </span>
                );
              })}
            </p>
          </section>

          {answers && answers.length > 0 && (
            <section>
              <h2 className="font-semibold">{t("Réponses acceptées")}</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {answers.map((a) => {
                  const q = a.question as unknown as { id: string; title: string };
                  return (
                    <li key={a.id}>
                      <Link href={`/questions/${q.id}`} className="hover:text-primary">
                        {q.title}
                      </Link>{" "}
                      <span className="text-xs text-muted">· {a.score}{" "}{t("votes")}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {projects && projects.length > 0 && (
            <section>
              <h2 className="font-semibold">{t("Projets")}</h2>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {projects.map((pr) => (
                  <li key={pr.slug} className="rounded-lg border border-border bg-surface p-3 text-sm">
                    <Link href={`/showroom/${pr.slug}`} className="font-medium hover:text-primary">
                      {pr.name}
                    </Link>
                    <p className="line-clamp-2 text-xs text-muted">{pr.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {badges && badges.length > 0 && (
            <p className="flex flex-wrap gap-1 text-xs">
              {badges.map((b, i) => {
                const badge = b.badges as unknown as { name: string; tier: string };
                return (
                  <span key={i} className="rounded-full border border-border px-2 py-0.5">
                    {badge.name} · {badge.tier}
                  </span>
                );
              })}
            </p>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">{t("Note privée")}</h2>
            <form action={saveNote.bind(null, p.id, back)} className="mt-2 space-y-2">
              <textarea name="note" rows={3} maxLength={500} defaultValue={shortlist?.note ?? ""} placeholder={t("Visible de vous seul")} className={input} />
              <button className="rounded-full border border-border px-3 py-1 text-xs">{t("Enregistrer (et présélectionner)")}</button>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">{t("Proposer une opportunité")}</h2>
            {!p.recruiter_visible ? (
              <p className="mt-2 text-sm text-muted">{t("Ce dev ne reçoit plus de propositions.")}</p>
            ) : pending ? (
              <p className="mt-2 text-sm text-muted">{t("Proposition «")}{" "}{pending.title}{" "}{t("» en attente depuis")}{" "}{timeAgo(pending.created_at)}.</p>
            ) : (
              <form action={sendContact.bind(null, p.id, back)} className="mt-2 space-y-2">
                <select name="offer_kind" className={input} defaultValue={p.open_to[0] && OFFER_KIND[p.open_to[0]] ? p.open_to[0] : "mission"}>
                  {Object.entries(OFFER_KIND).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input name="title" required minLength={3} maxLength={120} placeholder={t("Intitulé du poste ou de la mission")} className={input} />
                <textarea name="message" required minLength={20} maxLength={1500} rows={5} placeholder={t("Contexte, missions, durée, lieu…")} className={input} />
                <input name="budget" maxLength={80} placeholder={t("Rémunération ou budget (facultatif)")} className={input} />
                <button className="w-full rounded-full bg-primary py-2 text-sm font-medium text-primary-ink">{t("Envoyer la proposition")}</button>
                <p className="text-xs text-muted">{t("La conversation s'ouvre si le dev accepte. Une proposition utilise une prise de contact de votre quota.")}</p>
              </form>
            )}
          </section>

          {contacts && contacts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold">{t("Historique")}</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {contacts.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border p-2">
                    <p>{c.title}</p>
                    <p className="text-xs text-muted">
                      {OFFER_KIND[c.offer_kind]} · {CONTACT_STATUS[c.status]} · {timeAgo(c.created_at)}
                    </p>
                    {c.decline_reason && <p className="text-xs text-muted">« {c.decline_reason} »</p>}
                    {c.conversation_id && (
                      <Link href={`/discussions/${c.conversation_id}`} className="text-xs text-primary">
                        {t("Ouvrir la conversation →")}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
