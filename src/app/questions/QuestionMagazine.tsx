"use client";

import Link from "next/link";
import { useState } from "react";
import { UserChip } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { QuestionImages } from "@/components/QuestionImages";
import { timeAgo } from "@/lib/format";

type Question = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  images: string[] | null;
  answers_count: number;
  accepted_answer_id: string | null;
  bounty_id: string | null;
  created_at: string;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
    xp: number | null;
  } | null;
};

export function QuestionMagazine({
  questions,
  initialSelectedId,
}: {
  questions: Question[];
  initialSelectedId: string | null;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? questions[0]?.id ?? null);
  const selectedQuestion = questions.find((question) => question.id === selectedId) ?? questions[0];

  if (!questions.length) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">
        Aucune question trouvée.
      </div>
    );
  }

  return (
    <section className="mt-6 grid gap-4 lg:h-[calc(100dvh-24rem)] lg:min-h-[20rem] lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.8fr)] 2xl:h-[calc(100dvh-21rem)]">
      <article
        aria-live="polite"
        className="min-h-72 overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7 lg:min-h-0 lg:p-8"
      >
        {selectedQuestion && (
          <div key={selectedQuestion.id} className="animate-magazine-detail">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {selectedQuestion.accepted_answer_id && (
                <span className="rounded-full bg-leaf/10 px-3 py-1 font-semibold text-leaf">Réponse validée</span>
              )}
              {selectedQuestion.bounty_id && (
                <span className="rounded-full bg-gold/10 px-3 py-1 font-semibold text-gold">Question primée</span>
              )}
              <span className="text-muted">{timeAgo(selectedQuestion.created_at)}</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{selectedQuestion.title}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {selectedQuestion.author && <UserChip user={selectedQuestion.author} />}
              <span className="rounded-full border border-border px-3 py-1 text-sm text-muted">
                {selectedQuestion.answers_count} réponse{selectedQuestion.answers_count > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedQuestion.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/questions?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-tech/10 px-3 py-1 font-mono text-xs text-tech hover:bg-tech/15"
                >
                  {tag}
                </Link>
              ))}
            </div>
            <div className="my-6 border-t border-border" />
            <Markdown text={selectedQuestion.body} />
            <QuestionImages images={selectedQuestion.images ?? []} />
            <Link
              href={`/questions/${selectedQuestion.id}`}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-ink hover:opacity-90"
            >
              Lire les réponses et participer <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </article>

      <aside
        aria-label="Liste des questions"
        className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-background/70 p-3 lg:h-full"
      >
        <h2 className="sticky top-0 z-10 rounded-xl bg-background/95 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted backdrop-blur">
          Les plus récentes
        </h2>
        <ul className="space-y-2">
          {questions.map((question) => {
            const active = question.id === selectedQuestion?.id;
            return (
              <li key={question.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(question.id)}
                  className={`group w-full rounded-xl border p-3 text-left motion-safe:transition motion-safe:duration-200 motion-reduce:transition-none ${
                    active
                      ? "border-primary/50 bg-primary/10 shadow-sm shadow-primary/10"
                      : "border-transparent bg-surface hover:border-border hover:bg-surface/80 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className={`font-semibold leading-snug ${active ? "text-primary" : "group-hover:text-primary"}`}>
                      {question.title}
                    </span>
                    <span className="shrink-0 rounded-lg bg-background px-2 py-1 text-xs text-muted">
                      {question.answers_count}
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {question.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-tech/10 px-2 py-0.5 font-mono text-tech">
                        {tag}
                      </span>
                    ))}
                    <span className="ml-auto">{timeAgo(question.created_at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </section>
  );
}
