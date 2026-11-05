"use client";

import Link from "next/link";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { CloneAnswer } from "@/lib/clone";
import { flagQuery, rateQuery } from "../actions";

export type PastQuery = {
  id: string;
  question: string;
  answer: string;
  status: string;
  billing: string;
  price: number;
  rating: number | null;
  flagged_reason: string | null;
  refunded: boolean;
  created_at: string;
};

const BILLING: Record<string, string> = {
  owner_test: "Test (gratuit pour toi)",
  free_first: "Première question offerte",
  paid: "100 FCFA",
  pass: "Incluse dans ton Pass",
  repeat: "Question répétée : non facturée",
  not_billed: "Non facturée",
};

function Turn({ q, isOwner }: { q: PastQuery & { sources?: CloneAnswer["sources"] }; isOwner: boolean }) {
  const [rating, setRating] = useState(q.rating);
  const [flagged, setFlagged] = useState(Boolean(q.flagged_reason));
  const [note, setNote] = useState<string | null>(null);

  return (
    <li className="space-y-2">
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-primary-ink">{q.question}</p>
      <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">🤖 Réponse du clone IA</p>
        <Markdown text={q.answer} />
        {q.sources && q.sources.length > 0 && (
          <ol className="mt-3 space-y-1 border-t border-border pt-2 text-xs text-muted">
            {q.sources.map((s, i) => (
              <li key={s.id}>
                [{i + 1}] {s.title}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted">
          <span>{q.refunded ? "Remboursée" : (BILLING[q.billing] ?? q.billing)}</span>
          {!isOwner && q.status === "answered" && (
            <span className="flex items-center gap-3">
              <span className="flex" aria-label="Noter la réponse">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={async () => {
                      const { error } = await rateQuery(q.id, n);
                      if (error) setNote(error);
                      else setRating(n);
                    }}
                    className={`px-0.5 text-base ${rating && n <= rating ? "text-gold" : "text-border hover:text-gold"}`}
                    aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
              </span>
              {!flagged && (
                <button
                  onClick={async () => {
                    const reason = prompt("Qu'est-ce qui ne va pas dans cette réponse ?");
                    if (!reason) return;
                    const { error } = await flagQuery(q.id, reason);
                    if (error) setNote(error);
                    else {
                      setFlagged(true);
                      setNote(q.price > 0 ? "Signalée : tes 100 FCFA te sont remboursés." : "Signalée, merci.");
                    }
                  }}
                  className="hover:text-primary"
                >
                  Mauvaise réponse ?
                </button>
              )}
            </span>
          )}
        </div>
        {note && <p className="mt-1 text-xs text-primary">{note}</p>}
      </div>
    </li>
  );
}

export function CloneChat({
  cloneId,
  history,
  isOwner,
  billingHint,
}: {
  cloneId: string;
  history: PastQuery[];
  isOwner: boolean;
  billingHint: string;
}) {
  const [turns, setTurns] = useState<(PastQuery & { sources?: CloneAnswer["sources"] })[]>(history);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsTopup, setNeedsTopup] = useState(false);

  async function ask() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setNeedsTopup(false);
    const res = await fetch(`/api/clones/${cloneId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error);
      setNeedsTopup(res.status === 402);
      return;
    }
    const r = json as CloneAnswer;
    setQuestion("");
    setTurns((t) => [
      ...t,
      {
        id: r.queryId,
        question: q,
        answer: r.answer,
        status: r.status,
        billing: r.billing,
        price: r.price,
        rating: null,
        flagged_reason: null,
        refunded: false,
        created_at: new Date().toISOString(),
        sources: r.sources,
      },
    ]);
  }

  return (
    <div>
      <ol className="space-y-6">
        {turns.map((t) => (
          <Turn key={t.id} q={t} isOwner={isOwner} />
        ))}
        {loading && <li className="animate-pulse text-sm text-muted">Le clone consulte les contenus de son senior…</li>}
      </ol>

      {error && (
        <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
          {error}{" "}
          {needsTopup && (
            <Link href="/portefeuille" className="font-medium underline">
              Recharger
            </Link>
          )}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="sticky bottom-4 mt-6 rounded-2xl border border-border bg-surface p-2 shadow-sm"
      >
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={isOwner ? "Teste ton clone avant de le publier…" : "Pose ta question…"}
            className="flex-1 bg-transparent px-3 outline-none"
          />
          <button disabled={loading} className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-ink disabled:opacity-50">
            Demander
          </button>
        </div>
        <p className="px-3 pt-1 text-[11px] text-muted">{billingHint}</p>
      </form>
    </div>
  );
}
