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
    .select("id, title, tags, images, answers_count, accepted_answer_id, bounty_id, created_at, author:profiles!questions_author_id_fkey(username, full_name, avatar_url, city)")
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

      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
        {questions?.length ? (
          questions.map((question) => (
            <li key={question.id} className="flex gap-4 p-4">
              <div
                className={`flex w-16 shrink-0 flex-col items-center justify-center rounded-lg text-center text-xs ${
                  question.accepted_answer_id ? "bg-leaf text-background" : "border border-border text-muted"
                }`}
              >
                <span className="text-lg font-semibold">{question.answers_count}</span>
                réponse{question.answers_count > 1 ? "s" : ""}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/questions/${question.id}`} className="font-medium hover:text-primary">
                  {question.title}
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {question.images?.length > 0 && (
                    <span className="rounded border border-border px-2 py-0.5 text-muted" title="Question avec images">
                      🖼 {question.images.length}
                    </span>
                  )}
                  {question.bounty_id && (
                    <span className="rounded bg-gold/20 px-2 py-0.5 font-medium text-gold">Prime</span>
                  )}
                  {question.tags.map((t: string) => (
                    <Link key={t} href={`/questions?tag=${encodeURIComponent(t)}`} className="rounded bg-background px-2 py-0.5 font-mono hover:text-primary">
                      {t}
                    </Link>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {question.author && <UserChip user={question.author as never} />}
                  <span>· {timeAgo(question.created_at)}</span>
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="p-6 text-center text-muted">Aucune question trouvée.</li>
        )}
      </ul>
    </main>
  );
}
