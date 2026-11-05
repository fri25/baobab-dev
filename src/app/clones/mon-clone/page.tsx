import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { addAnswerSource, addNoteSource, createClone, removeSource, setCloneStatus, updateClone } from "../actions";

export const metadata = { title: "Mon clone IA · Baobab Dev" };

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

type Dashboard = {
  questions: number;
  questions_month: number;
  revenue_month: number;
  revenue_total: number;
  avg_rating: number | null;
  unanswered: number;
  flagged: number;
};

function CloneFields({ clone }: { clone?: { name: string; specialty: string; description: string | null; style_notes: string | null } }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Nom du clone
          <input name="name" required defaultValue={clone?.name} placeholder="Koffi IA" className={input} />
        </label>
        <label className="block text-sm font-medium">
          Spécialité (le clone refuse le reste)
          <input name="specialty" required defaultValue={clone?.specialty} placeholder="Laravel et paiements Mobile Money" className={input} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Présentation
        <textarea name="description" rows={2} defaultValue={clone?.description ?? ""} className={input} />
      </label>
      <label className="block text-sm font-medium">
        Ton style et tes méthodes
        <input name="style_notes" defaultValue={clone?.style_notes ?? ""} placeholder="direct, va droit au code, insiste sur la sécurité" className={input} />
      </label>
    </>
  );
}

export default async function MyClonePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, user, profile } = await requireSession("/clones/mon-clone");
  const { error } = await searchParams;

  const { data: clone } = await supabase.from("ai_clones").select("*").eq("owner_id", user.id).maybeSingle();

  if (!clone) {
    const eligible = profile.xp >= 2000;
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Créer mon clone IA</h1>
        <p className="mt-1 text-muted">
          Ton savoir devient un assistant qui répond à ta place et te reverse 70 % des revenus, sans heure de travail en plus.
          Par exemple, 265 questions payées dans le mois te rapportent 18 550 FCFA.
        </p>
        {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}
        {eligible ? (
          <form action={createClone} className="mt-6 space-y-4">
            <CloneFields />
            <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Créer le brouillon</button>
          </form>
        ) : (
          <p className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
            Le clone IA se débloque au niveau <strong>Expert</strong> (2 000 XP). Tu as {profile.xp} XP : réponds aux questions et
            résous des tickets pour y arriver.
          </p>
        )}
      </main>
    );
  }

  const [{ data: dashboard }, { data: sources }, { data: answers }, { data: recent }] = await Promise.all([
    supabase.rpc("clone_dashboard").single<Dashboard>(),
    supabase.from("clone_sources").select("id, kind, answer_id, title, content, created_at").eq("clone_id", clone.id).order("created_at"),
    supabase
      .from("answers")
      .select("id, score, is_accepted, question:questions!answers_question_id_fkey(title)")
      .eq("author_id", user.id)
      .or("is_accepted.eq.true,score.gte.1")
      .order("created_at", { ascending: false }),
    supabase
      .from("clone_queries")
      .select("id, question, status, billing, rating, flagged_reason, created_at")
      .eq("clone_id", clone.id)
      .neq("billing", "owner_test")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const used = new Set((sources ?? []).map((s) => s.answer_id).filter(Boolean));
  const available = (answers ?? []).filter((a) => !used.has(a.id));
  const d = dashboard;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{clone.name}</h1>
          <p className="text-sm text-muted">
            {clone.status === "published" ? "Publié" : clone.status === "suspended" ? "Suspendu : note moyenne trop basse" : "Brouillon"} ·{" "}
            <Link href={`/clones/${clone.id}`} className="text-primary">
              {clone.status === "published" ? "voir la page publique" : "tester mon clone"}
            </Link>
          </p>
        </div>
        {clone.status !== "suspended" && (
          <form action={setCloneStatus.bind(null, clone.status === "published" ? "draft" : "published")}>
            <button
              className={`rounded-full px-5 py-2 text-sm font-medium ${clone.status === "published" ? "border border-border" : "bg-leaf text-background"}`}
            >
              {clone.status === "published" ? "Repasser en brouillon" : "Publier mon clone"}
            </button>
          </form>
        )}
      </div>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      {/* Tableau de bord */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Revenus du mois", fcfa(d?.revenue_month ?? 0)],
          ["Revenus cumulés", fcfa(d?.revenue_total ?? 0)],
          ["Questions traitées", `${d?.questions ?? 0} (${d?.questions_month ?? 0} ce mois)`],
          ["Note moyenne", d?.avg_rating ? `★ ${d.avg_rating}` : "—"],
          ["Sans réponse", String(d?.unanswered ?? 0)],
          ["Signalées", String(d?.flagged ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-3">
            <p className="font-mono text-lg font-bold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </section>
      <p className="mt-2 text-xs text-muted">
        70 % pour toi, 30 % pour la plateforme (IA, paiements, modération). Versement automatique le 30 du mois vers Mobile Money (V1).
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-semibold">Sources ({sources?.length ?? 0})</h2>
          <p className="text-xs text-muted">Le clone ne répond qu&apos;avec ces contenus. Au moins 3 pour publier. Retire-les quand tu veux.</p>
          <ul className="mt-3 space-y-2">
            {sources?.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted">
                    {s.kind === "answer" ? "Ta réponse" : "Note"} · {s.content.length} caractères
                  </p>
                </div>
                <form action={removeSource.bind(null, s.id)}>
                  <button className="text-xs text-muted hover:text-primary">Retirer</button>
                </form>
              </li>
            ))}
          </ul>

          {available.length > 0 && (
            <details className="mt-4 rounded-lg border border-border bg-surface p-3">
              <summary className="cursor-pointer text-sm font-medium">Ajouter une de mes réponses ({available.length})</summary>
              <ul className="mt-2 space-y-2">
                {available.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {(a.question as unknown as { title: string }).title}
                      <span className="ml-1 text-xs text-muted">{a.is_accepted ? "· validée" : `· ${a.score} vote(s)`}</span>
                    </span>
                    <form action={addAnswerSource.bind(null, a.id)}>
                      <button className="shrink-0 rounded border border-border px-2 py-0.5 text-xs">Ajouter</button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <form action={addNoteSource.bind(null, clone.id)} className="mt-4 space-y-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-sm font-medium">Ajouter une note, un tutoriel ou une revue de code</p>
            <input name="title" required placeholder="Titre" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
            <textarea
              name="content"
              required
              rows={5}
              placeholder="Ton savoir, avec du code entre ```"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
            />
            <button className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-ink">Ajouter la source</button>
          </form>
        </section>

        <div className="space-y-8">
          <section>
            <h2 className="font-semibold">Dernières questions</h2>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
              {recent?.map((q) => (
                <li key={q.id} className="px-4 py-2.5 text-sm">
                  <p className="line-clamp-2">{q.question}</p>
                  <p className="text-xs text-muted">
                    {timeAgo(q.created_at)}
                    {q.status !== "answered" && " · sans réponse"}
                    {q.rating && ` · ★ ${q.rating}`}
                    {q.flagged_reason && <span className="text-primary"> · signalée : {q.flagged_reason}</span>}
                  </p>
                </li>
              ))}
              {!recent?.length && <li className="px-4 py-4 text-sm text-muted">Aucune question pour l&apos;instant.</li>}
            </ul>
          </section>

          <section>
            <h2 className="font-semibold">Réglages</h2>
            <form action={updateClone.bind(null, clone.id)} className="mt-3 space-y-3">
              <CloneFields clone={clone} />
              <button className="rounded-full border border-border px-5 py-2 text-sm">Enregistrer</button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
