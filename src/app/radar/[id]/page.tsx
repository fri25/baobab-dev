import Link from "next/link";
import { notFound } from "next/navigation";
import { UserChip } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { budgetLabel, ORG_TYPE, RESPONSE_STATUS, scoreClass } from "@/lib/radar-labels";
import { closeOpportunity, publishOpportunity, respond, reviewOpportunity, setResponseStatus } from "../actions";
import { Deadline } from "../Deadline";

type Person = { username: string; full_name: string | null; avatar_url: string | null; city: string | null };
const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function OpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; brouillon?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await getSession();
  const isModerator = ["moderator", "admin"].includes(profile?.role ?? "");

  const { data: o } = await supabase.from("opportunities").select("*").eq("id", id).maybeSingle();
  if (!o) notFound();
  const isPublisher = user?.id === o.publisher_id;

  // Brouillon (ou refus) : l'organisation relit et corrige l'extraction avant de l'envoyer en validation
  if ((o.status === "draft" || (o.status === "rejected" && isPublisher)) && isPublisher) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Vérifie ton besoin avant publication</h1>
        <p className="mt-1 text-muted">
          {o.extracted_by === "ia" ? "Extrait par l'IA" : "Extrait automatiquement"} à partir de ton texte. Corrige ce qui ne va pas.
        </p>
        {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}
        {o.status === "rejected" && (
          <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
            L&apos;administration n&apos;a pas validé cette opportunité{o.review_note ? ` : ${o.review_note}` : "."} Corrige-la et renvoie-la.
          </p>
        )}
        <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          Chaque opportunité est relue par l&apos;administration de la plateforme avant d&apos;être visible du public : cela protège
          les devs des annonces trompeuses. Les profils correspondants sont alertés dès la validation.
        </p>
        <form action={publishOpportunity.bind(null, id)} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Titre
            <input name="title" required defaultValue={o.title} className={input} />
          </label>
          <label className="block text-sm font-medium">
            Le besoin en une ou deux phrases
            <textarea name="need" required rows={3} defaultValue={o.need} className={input} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Organisation
              <input name="organization_name" required defaultValue={o.organization_name} className={input} />
            </label>
            <label className="block text-sm font-medium">
              Type
              <select name="org_type" defaultValue={o.org_type} className={input}>
                {Object.entries(ORG_TYPE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Technologies (séparées par des virgules) : elles servent au calcul des correspondances
            <input name="technologies" defaultValue={o.technologies.join(", ")} className={`${input} font-mono text-sm`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Budget min. (FCFA)
              <input name="budget_min" type="number" min={0} defaultValue={o.budget_min ?? undefined} className={input} />
            </label>
            <label className="block text-sm font-medium">
              Budget max. (FCFA)
              <input name="budget_max" type="number" min={0} defaultValue={o.budget_max ?? undefined} className={input} />
            </label>
            <label className="block text-sm font-medium">
              Date limite
              <input name="deadline" type="date" defaultValue={o.deadline ?? undefined} className={input} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Pays
              <input name="country" defaultValue={o.country ?? ""} className={input} />
            </label>
            <label className="block text-sm font-medium">
              Ville
              <input name="city" defaultValue={o.city ?? ""} className={input} />
            </label>
            <label className="block text-sm font-medium">
              Contact
              <input name="contact" defaultValue={o.contact ?? ""} className={input} />
            </label>
          </div>
          <details className="rounded-lg border border-border bg-surface p-3 text-sm">
            <summary className="cursor-pointer text-muted">Ton texte d&apos;origine</summary>
            <p className="mt-2 whitespace-pre-line">{o.raw_text}</p>
          </details>
          <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Envoyer pour validation</button>
        </form>
      </main>
    );
  }

  const [{ data: mine }, { data: mySquads }, { data: responses }, { data: matches }] = await Promise.all([
    user ? supabase.rpc("my_opportunities") : Promise.resolve({ data: [] }),
    user ? supabase.from("squads").select("id, name").eq("owner_id", user.id).in("status", ["recruiting", "active"]) : Promise.resolve({ data: [] }),
    supabase
      .from("opportunity_responses")
      .select("id, responder_id, message, proposed_budget, status, created_at, squad:squads(id, name), responder:profiles!opportunity_responses_responder_id_fkey(username, full_name, avatar_url, city)")
      .eq("opportunity_id", id)
      .order("created_at"),
    isPublisher
      ? supabase.from("opportunity_matches").select("target_type, target_id, score, reasons").eq("opportunity_id", id).order("score", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
  ]);
  const myMatch = ((mine ?? []) as { opportunity_id: string; score: number; reasons: string[]; via_squad: string | null }[]).find((m) => m.opportunity_id === id);
  const myResponse = responses?.find((r) => r.responder_id === user?.id);

  // L'organisation voit les talents correspondants
  const userIds = (matches ?? []).filter((m) => m.target_type === "user").map((m) => m.target_id);
  const { data: talents } = userIds.length
    ? await supabase.from("profiles").select("id, username, full_name, avatar_url, city").in("id", userIds)
    : { data: [] };
  const talentOf = new Map((talents ?? []).map((t) => [t.id, t]));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/radar" className="text-sm text-muted hover:text-primary">
        ← Radar
      </Link>
      {error && <p className="mt-3 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <div className="mt-3 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-sm text-muted">
            {o.organization_name} · {ORG_TYPE[o.org_type]}
            {o.city && ` · ${o.city}`}
            {o.country && `, ${o.country}`} · {o.source === "collectee" ? "appel d'offres collecté" : "publié"} {timeAgo(o.created_at)}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{o.title}</h1>
          {o.status === "closed" && <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-muted">Opportunité close.</p>}
          {o.status === "pending" && (
            <p className="mt-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
              En attente de validation par l&apos;administration : pas encore visible du public.
            </p>
          )}
          {o.status === "rejected" && (
            <p className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
              Non validée par l&apos;administration{o.review_note ? ` : ${o.review_note}` : "."}
            </p>
          )}
          {o.status === "open" && o.deadline && (
            <p className="mt-2">
              <Deadline date={o.deadline} />
            </p>
          )}
          {isModerator && o.status === "pending" && (
            <div className="mt-4 rounded-xl border border-primary bg-surface p-4 text-sm">
              <p className="font-semibold">Validation par l&apos;administration</p>
              <p className="text-xs text-muted">
                Vérifie l&apos;organisation, le budget et la date limite{o.source_url ? " par rapport à l'annonce d'origine" : ""}. À la
                validation, l&apos;opportunité devient publique et les profils correspondants sont alertés.
              </p>
              {o.source_url && (
                <a href={o.source_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block truncate font-mono text-xs text-primary">
                  {o.source_url}
                </a>
              )}
              <form className="mt-3 space-y-2">
                <input type="hidden" name="back" value={`/radar/${id}`} />
                <input name="note" placeholder="Motif (obligatoire pour un refus, transmis à l'organisation)" className="w-full rounded-lg border border-border bg-background px-3 py-2" />
                <div className="flex gap-2">
                  <button formAction={reviewOpportunity.bind(null, id, true)} className="rounded-full bg-leaf px-4 py-1.5 font-medium text-background">
                    Valider et publier
                  </button>
                  <button formAction={reviewOpportunity.bind(null, id, false)} className="rounded-full border border-border px-4 py-1.5">
                    Refuser
                  </button>
                </div>
              </form>
            </div>
          )}
          <p className="mt-4 text-lg">{o.need}</p>

          <dl className="mt-5 grid gap-3 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Budget</dt>
              <dd className="font-medium">{budgetLabel(o.budget_min, o.budget_max)}</dd>
            </div>
            <div>
              <dt className="text-muted">Date limite</dt>
              <dd className="font-medium">{o.deadline ? new Date(o.deadline).toLocaleDateString("fr-FR") : "Non précisée"}</dd>
            </div>
            <div>
              <dt className="text-muted">Technologies</dt>
              <dd className="flex flex-wrap gap-1">
                {o.technologies.map((t: string) => (
                  <Link key={t} href={`/radar?tech=${encodeURIComponent(t)}`} className="rounded bg-background px-1.5 font-mono text-xs hover:text-primary">
                    {t}
                  </Link>
                ))}
              </dd>
            </div>
          </dl>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted">Texte d&apos;origine</summary>
            <p className="mt-2 whitespace-pre-line rounded-lg border border-border bg-surface p-3">{o.raw_text}</p>
            {o.source_url && (
              <a href={o.source_url} className="mt-2 inline-block text-primary">
                Voir l&apos;annonce d&apos;origine
              </a>
            )}
          </details>
          {user && o.contact && <p className="mt-3 text-sm">Contact : {o.contact}</p>}

          {/* Réponses : l'organisation les gère, chaque dev voit la sienne */}
          {isPublisher ? (
            <section className="mt-8">
              <h2 className="font-semibold">Réponses ({responses?.length ?? 0})</h2>
              <ul className="mt-3 space-y-3">
                {responses?.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <UserChip user={r.responder as unknown as Person} />
                      <span className="text-xs text-muted">{RESPONSE_STATUS[r.status]}</span>
                    </div>
                    {r.squad && <p className="mt-1 text-xs text-leaf">Au nom de la Squad « {(r.squad as unknown as { name: string }).name} »</p>}
                    <p className="mt-2 whitespace-pre-line">{r.message}</p>
                    {r.proposed_budget && <p className="mt-1 text-xs text-muted">Proposition : {fcfa(r.proposed_budget)}</p>}
                    {o.status === "open" && r.status !== "accepted" && (
                      <div className="mt-3 flex gap-2">
                        {r.status === "sent" && (
                          <form action={setResponseStatus.bind(null, id, r.id, "shortlisted")}>
                            <button className="rounded-full border border-border px-3 py-1 text-xs">Présélectionner</button>
                          </form>
                        )}
                        <form action={setResponseStatus.bind(null, id, r.id, "accepted")}>
                          <button className="rounded-full bg-leaf px-3 py-1 text-xs text-background">Retenir</button>
                        </form>
                        <form action={setResponseStatus.bind(null, id, r.id, "declined")}>
                          <button className="rounded-full border border-border px-3 py-1 text-xs text-muted">Décliner</button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
                {!responses?.length && <li className="text-sm text-muted">Pas encore de réponse : les profils correspondants ont été alertés.</li>}
              </ul>
              {o.status === "open" && (
                <form action={closeOpportunity.bind(null, id)} className="mt-4">
                  <button className="text-xs text-muted hover:text-primary">Clore l&apos;opportunité</button>
                </form>
              )}
            </section>
          ) : myResponse ? (
            <p className="mt-8 rounded-xl border border-leaf bg-leaf/5 p-4 text-sm">
              Ta réponse est envoyée : <strong>{RESPONSE_STATUS[myResponse.status]}</strong>.
            </p>
          ) : (
            user &&
            o.status === "open" && (
              <form action={respond.bind(null, id)} className="mt-8 space-y-3 rounded-xl border border-dashed border-border p-4">
                <h2 className="font-semibold">Répondre à {o.organization_name}</h2>
                {(mySquads?.length ?? 0) > 0 && (
                  <label className="block text-sm">
                    Répondre
                    <select name="squad_id" className={input}>
                      <option value="">En mon nom</option>
                      {mySquads!.map((s) => (
                        <option key={s.id} value={s.id}>
                          Au nom de la Squad « {s.name} »
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <textarea
                  name="message"
                  required
                  minLength={20}
                  rows={5}
                  placeholder="Présente ton approche, une réalisation proche et ta disponibilité."
                  className={input}
                />
                <label className="block text-sm">
                  Budget proposé (FCFA, facultatif)
                  <input name="proposed_budget" type="number" min={0} step={10000} className={input} />
                </label>
                <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">Envoyer ma réponse</button>
              </form>
            )
          )}
        </div>

        <aside className="space-y-6">
          {myMatch ? (
            <section className="rounded-2xl border border-border bg-surface p-5 text-center">
              <p className="text-xs uppercase tracking-wide text-muted">Correspondance avec {myMatch.via_squad ? `ta Squad « ${myMatch.via_squad} »` : "ton profil"}</p>
              <p className={`mx-auto mt-2 flex h-20 w-20 flex-col items-center justify-center rounded-2xl font-mono ${scoreClass(myMatch.score)}`}>
                <span className="text-3xl font-bold">{myMatch.score}</span>
                <span className="text-xs">/100</span>
              </p>
              <ul className="mt-3 space-y-1 text-left text-xs text-muted">
                {myMatch.reasons.map((r) => (
                  <li key={r}>✓ {r}</li>
                ))}
              </ul>
            </section>
          ) : (
            user && !isPublisher && (
              <p className="rounded-xl border border-border bg-surface p-4 text-xs text-muted">
                Aucune technologie de ton profil ne correspond. Complète tes technologies dans{" "}
                <Link href="/parametres" className="text-primary">
                  tes paramètres
                </Link>
                .
              </p>
            )
          )}

          {isPublisher && (matches?.length ?? 0) > 0 && (
            <section>
              <h2 className="font-semibold">Talents correspondants</h2>
              <ul className="mt-3 space-y-2">
                {matches!
                  .filter((m) => m.target_type === "user" && talentOf.has(m.target_id))
                  .map((m) => (
                    <li key={m.target_id} className="flex items-center justify-between gap-2 text-sm">
                      <UserChip user={talentOf.get(m.target_id)!} />
                      <span className={`rounded-lg px-2 py-0.5 font-mono text-xs ${scoreClass(m.score)}`}>{m.score}</span>
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                {(matches ?? []).filter((m) => m.target_type === "squad").length} Squad(s) correspondante(s). Les profils au-dessus de 50 ont été alertés.
              </p>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
