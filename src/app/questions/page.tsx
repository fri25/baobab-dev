import Link from "next/link";
import { QuestionMagazine } from "@/app/questions/QuestionMagazine";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Questions · Baobab Dev" };

type Props = { searchParams: Promise<{ q?: string; tag?: string; filtre?: string; selection?: string }> };

export default async function QuestionsPage({ searchParams }: Props) {
  const { q, tag, filtre, selection } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("questions")
    .select("id, title, body, tags, images, answers_count, accepted_answer_id, bounty_id, created_at, author:profiles!questions_author_id_fkey(username, full_name, avatar_url, city, xp)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (q) query = query.textSearch("search", q, { type: "websearch", config: "french" });
  if (tag) query = query.contains("tags", [tag]);
  if (filtre === "sans-reponse") query = query.eq("answers_count", 0);
  if (filtre === "primes") query = query.not("bounty_id", "is", null);
  const { data: questions } = await query;
  const magazineQuestions = (questions ?? []).map((question) => ({ ...question, author: question.author as never }));
  const initialSelectedId = magazineQuestions.some((question) => question.id === selection)
    ? selection!
    : magazineQuestions[0]?.id ?? null;
  const filterHref = (value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (value) params.set("filtre", value);
    const search = params.toString();
    return search ? `/questions?${search}` : "/questions";
  };

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
        {tag && <input type="hidden" name="tag" value={tag} />}
        {filtre && <input type="hidden" name="filtre" value={filtre} />}
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
            href={filterHref(value)}
            className={`rounded-full px-3 py-1 ${(filtre ?? "") === value && !tag && !q ? "bg-foreground text-background" : "border border-border"}`}
          >
            {label}
          </Link>
        ))}
        {tag && <span className="rounded-full bg-foreground px-3 py-1 text-background">#{tag}</span>}
      </nav>

      <QuestionMagazine questions={magazineQuestions} initialSelectedId={initialSelectedId} />
    </main>
  );
}
