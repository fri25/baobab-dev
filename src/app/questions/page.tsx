import Link from "next/link";
import { UserChip } from "@/components/Avatar";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Questions · Baobab Dev" };

type Props = { searchParams: Promise<{ q?: string; tag?: string; filtre?: string }> };

export default async function QuestionsPage({ searchParams }: Props) {
  const { q, tag, filtre } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("questions")
    .select("id, title, tags, images, answers_count, accepted_answer_id, bounty_id, created_at, author:profiles!questions_author_id_fkey(username, full_name, avatar_url, city, xp)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (q) query = query.textSearch("search", q, { type: "websearch", config: "french" });
  if (tag) query = query.contains("tags", [tag]);
  if (filtre === "sans-reponse") query = query.eq("answers_count", 0);
  if (filtre === "primes") query = query.not("bounty_id", "is", null);
  const { data: questions } = await query;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Questions</h1>
        <div className="flex gap-2">
          <Link href="/griot" className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">
            Demander au Griot
          </Link>
          <Link href="/questions/new" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
            Poser une question
          </Link>
        </div>
      </div>

      <form className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher : webhook FedaPay, USSD, Flutter hors ligne…"
          className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm"
        />
        <button className="rounded-full border border-border px-4 text-sm">Chercher</button>
      </form>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {[
          ["", "Récentes"],
          ["sans-reponse", "Sans réponse"],
          ["primes", "Avec prime"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/questions?filtre=${value}` : "/questions"}
            className={`rounded-full px-3 py-1 ${(filtre ?? "") === value && !tag && !q ? "bg-foreground text-background" : "border border-border"}`}
          >
            {label}
          </Link>
        ))}
        {tag && <span className="rounded-full bg-foreground px-3 py-1 text-background">#{tag}</span>}
      </nav>

        <ul className="mt-6 space-y-3">
        {questions?.length ? (
          questions.map((question) => (
            <li
              key={question.id}
              className="group rounded-2xl border border-border/80 bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg sm:p-5"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-center text-[10px] sm:h-16 sm:w-16 ${
                    question.accepted_answer_id ? "bg-leaf/10 text-leaf ring-1 ring-leaf/25" : "bg-background text-muted ring-1 ring-border"
                  }`}
                >
                  <span className="text-lg font-bold leading-none">{question.answers_count}</span>
                  <span className="mt-1">réponse{question.answers_count > 1 ? "s" : ""}</span>
                  {question.accepted_answer_id && <span className="mt-0.5 font-semibold">Résolue</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/questions/${question.id}`} className="text-base font-semibold leading-snug group-hover:text-primary sm:text-lg">
                    {question.title}
                  </Link>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {question.images?.length > 0 && (
                      <span className="rounded-full border border-border px-2.5 py-1 text-muted" title="Question avec images">
                        🖼 {question.images.length}
                      </span>
                    )}
                    {question.bounty_id && <span className="rounded-full bg-gold/10 px-2.5 py-1 font-semibold text-gold">Prime</span>}
                    {question.tags.map((t: string) => (
                      <Link
                        key={t}
                        href={`/questions?tag=${encodeURIComponent(t)}`}
                        className="rounded-full bg-tech/10 px-2.5 py-1 font-mono text-tech hover:bg-tech/15"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {question.author && <UserChip user={question.author as never} />}
                    <span aria-hidden="true">·</span>
                    <span>{timeAgo(question.created_at)}</span>
                  </div>
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">Aucune question trouvée.</li>
        )}
      </ul>
    </main>
  );
}
