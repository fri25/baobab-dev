import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserChip } from "@/components/Avatar";
import { DraftTextarea } from "@/components/DraftTextarea";
import { Markdown } from "@/components/Markdown";
import { ImageUploader } from "@/components/ImageUploader";
import { QuestionImages } from "@/components/QuestionImages";
import { ReportButton } from "@/components/ReportButton";
import { getSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { acceptAnswer, addComment, createAnswer, vote } from "../actions";

type Comment = { id: string; target_id: string; body: string; created_at: string; author: { username: string; full_name: string | null } };

async function Comments({ comments, action }: { comments: Comment[]; action?: (formData: FormData) => Promise<void> }) {
  const t = await getT();
  return (
    <div className="mt-3 border-t border-border pt-2 text-sm">
      {comments.map((c) => (
        <p key={c.id} className="py-1 text-muted">
          {c.body} —{" "}
          <Link href={`/u/${c.author.username}`} className="text-foreground hover:text-primary">
            {c.author.full_name ?? c.author.username}
          </Link>{" "}
          <span className="text-xs">{timeAgo(c.created_at)}</span>
        </p>
      ))}
      {action && (
        <details>
          <summary className="cursor-pointer text-xs text-muted hover:text-primary">{t("Commenter")}</summary>
          <form action={action} className="mt-2 flex gap-2">
            <input name="body" required className="flex-1 rounded border border-border bg-background px-2 py-1" />
            <button className="rounded border border-border px-3">{t("Envoyer")}</button>
          </form>
        </details>
      )}
    </div>
  );
}

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const { id } = await params;
  const { supabase, user } = await getSession();

  const { data: question } = await supabase
    .from("questions")
    .select("*, author:profiles!questions_author_id_fkey(username, full_name, avatar_url, city), bounty:bounties!questions_bounty_fk(id, total_amount, status)")
    .eq("id", id)
    .maybeSingle();
  if (!question) notFound();

  const [{ data: answers }, { data: myVotes }] = await Promise.all([
    supabase
      .from("answers")
      .select("*, author:profiles!answers_author_id_fkey(username, full_name, avatar_url, city)")
      .eq("question_id", id)
      .order("is_accepted", { ascending: false })
      .order("score", { ascending: false })
      .order("created_at"),
    user
      ? supabase.from("votes").select("answer_id, value").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { answer_id: string; value: number }[] }),
  ]);
  const { data: comments } = await supabase
    .from("comments")
    .select("id, target_id, body, created_at, author:profiles!comments_author_id_fkey(username, full_name)")
    .in("target_id", [id, ...(answers ?? []).map((a) => a.id)])
    .order("created_at");

  const voteOf = new Map((myVotes ?? []).map((v) => [v.answer_id, v.value]));
  const commentsOf = (targetId: string) => ((comments ?? []) as unknown as Comment[]).filter((c) => c.target_id === targetId);
  const isAuthor = user?.id === question.author_id;
  const path = `/questions/${id}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/questions" className="text-sm text-muted hover:text-primary">
        {tr("← Questions")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{question.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        <UserChip user={question.author} />
        <span>· {timeAgo(question.created_at)}</span>
        {question.tags.map((t: string) => (
          <Link key={t} href={`/questions?tag=${encodeURIComponent(t)}`} className="rounded bg-surface px-2 py-0.5 font-mono text-xs">
            {t}
          </Link>
        ))}
      </div>

      {question.bounty ? (
        <Link
          href={`/bourse/${question.bounty.id}`}
          className="mt-4 flex items-center justify-between rounded-xl border border-gold bg-gold/10 p-4"
        >
          <span className="font-medium">{tr("Prime de la Micro-Bourse")}</span>
          <span className="font-mono font-semibold text-gold">{fcfa(question.bounty.total_amount)}</span>
        </Link>
      ) : (
        isAuthor &&
        !question.accepted_answer_id && (
          <Link
            href={`/bourse/new?question=${id}`}
            className="mt-4 block rounded-xl border border-dashed border-border p-3 text-sm text-muted hover:border-gold hover:text-foreground"
          >
            {tr("Toujours bloqué·e ?")}{" "}<span className="font-medium text-gold">{tr("Convertir en ticket de la Micro-Bourse avec une prime →")}</span>
          </Link>
        )
      )}

      <article className="mt-6 rounded-xl border border-border bg-surface p-5">
        <Markdown text={question.body} />
        <QuestionImages images={question.images ?? []} />
        <div className="mt-3 flex justify-end">
          {user && <ReportButton targetType="question" targetId={id} path={path} />}
        </div>
        <Comments comments={commentsOf(id)} action={user ? addComment.bind(null, id, "question", id) : undefined} />
      </article>

      <h2 className="mt-10 text-lg font-semibold">
        {answers?.length ?? 0}{" "}{tr("réponse")}{(answers?.length ?? 0) > 1 ? "s" : ""}
      </h2>
      <ul className="mt-4 space-y-4">
        {answers?.map((answer) => {
          const myVote = voteOf.get(answer.id);
          const isMine = user?.id === answer.author_id;
          return (
            <li
              key={answer.id}
              className={`flex gap-4 rounded-xl border bg-surface p-5 ${answer.is_accepted ? "border-leaf" : "border-border"}`}
            >
              <div className="flex flex-col items-center gap-1">
                <form action={vote.bind(null, id, answer.id, 1)}>
                  <button
                    disabled={!user || isMine}
                    aria-label={tr("Vote positif")}
                    className={`rounded px-2 text-lg disabled:opacity-40 ${myVote === 1 ? "text-leaf" : "text-muted hover:text-leaf"}`}
                  >
                    ▲
                  </button>
                </form>
                <span className="font-mono font-semibold">{answer.score}</span>
                <form action={vote.bind(null, id, answer.id, -1)}>
                  <button
                    disabled={!user || isMine}
                    aria-label={tr("Vote négatif")}
                    className={`rounded px-2 text-lg disabled:opacity-40 ${myVote === -1 ? "text-primary" : "text-muted hover:text-primary"}`}
                  >
                    ▼
                  </button>
                </form>
                {answer.is_accepted && (
                  <span className="mt-1 text-xl text-leaf" title={tr("Réponse validée par l'auteur")}>
                    ✓
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Markdown text={answer.body} />
                <QuestionImages images={answer.images ?? []} label="la réponse" />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <UserChip user={answer.author} />
                    <span className="text-muted">· {timeAgo(answer.created_at)}</span>
                    {answer.griot_citations_count > 0 && (
                      <span className="rounded bg-leaf/10 px-2 py-0.5 text-xs text-leaf">
                        {tr("Cité")}{" "}{answer.griot_citations_count}{tr("× par le Griot")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isAuthor && !question.accepted_answer_id && !isMine && (
                      <form action={acceptAnswer.bind(null, id, answer.id)}>
                        <button className="rounded-full border border-leaf px-3 py-1 text-xs text-leaf hover:bg-leaf hover:text-background">
                          {tr("Valider cette réponse")}
                        </button>
                      </form>
                    )}
                    {user && <ReportButton targetType="answer" targetId={answer.id} path={path} />}
                  </div>
                </div>
                <Comments
                  comments={commentsOf(answer.id)}
                  action={user ? addComment.bind(null, id, "answer", answer.id) : undefined}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {user ? (
        // La clé remonte le formulaire après chaque réponse publiée (vide les images jointes)
        <form key={answers?.length ?? 0} action={createAnswer.bind(null, id)} className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">{tr("Ta réponse")}</h2>
          <DraftTextarea
            draftKey={`reponse:${id}`}
            name="body"
            required
            rows={8}
            placeholder={tr("Explique ta solution. Encadre le code avec ```")}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
          />
          <ImageUploader userId={user.id} />
          <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">{tr("Répondre")}</button>
          <p className="text-xs text-muted">{tr("+10 XP par vote positif, +25 XP si ta réponse est validée, +5 XP à chaque citation du Griot.")}</p>
        </form>
      ) : (
        <p className="mt-8 rounded-xl border border-border bg-surface p-4 text-center text-sm">
          <Link href={`/login?next=${path}`} className="text-primary">
            {tr("Connecte-toi")}
          </Link>{" "}
          {tr("pour répondre et voter.")}
        </p>
      )}
    </main>
  );
}
