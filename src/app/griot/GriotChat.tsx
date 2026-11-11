"use client";

import Link from "next/link";
import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { GriotResult } from "@/lib/griot";

type Turn = {
  question: string;
  result?: GriotResult;
  error?: string;
  reviewPending?: boolean;
  reviewConsent?: boolean;
  reviewConversationId?: string;
  reviewNotifiedExperts?: number;
  reviewError?: string;
};

type GriotHistoryItem = {
  id: string;
  question: string;
  answer: string | null;
  created_at: string;
  escalated_conversation_id: string | null;
  escalated_question_id: string | null;
};

const EXAMPLES = [
  "Comment intégrer FedaPay dans Laravel et vérifier les webhooks ?",
  "Mes paiements Kkiapay restent en pending, pourquoi ?",
  "Comment gérer les sessions d'un menu USSD en Node.js ?",
];

export function GriotChat({
  history,
  historyHasMore: initialHistoryHasMore,
  historyUnavailable,
}: {
  history: GriotHistoryItem[];
  historyHasMore: boolean;
  historyUnavailable: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [historyItems, setHistoryItems] = useState(history);
  const [historyHasMore, setHistoryHasMore] = useState(initialHistoryHasMore);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadMoreHistory() {
    if (historyLoading || !historyHasMore) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/griot?offset=${historyItems.length}`);
      const json = (await res.json()) as { history?: GriotHistoryItem[]; hasMore?: boolean; error?: string };
      if (!res.ok || !Array.isArray(json.history)) throw new Error(json.error ?? "Impossible de charger l’historique.");
      const nextHistory = json.history;
      setHistoryItems((items) => [...items, ...nextHistory]);
      setHistoryHasMore(Boolean(json.hasMore));
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Impossible de charger l’historique.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function requestExpertReview(queryId: string) {
    setTurns((t) => t.map((turn) => (turn.result?.queryId === queryId ? { ...turn, reviewPending: true, reviewError: undefined } : turn)));
    try {
      const res = await fetch("/api/griot/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryId, publicConsent: true }),
      });
      const json = (await res.json()) as { conversationId?: string; notifiedExperts?: number; error?: string };
      if (!res.ok || !json.conversationId) throw new Error(json.error ?? "Impossible de demander une validation.");
      setTurns((t) =>
        t.map((turn) =>
          turn.result?.queryId === queryId
            ? {
                ...turn,
                reviewPending: false,
                reviewConversationId: json.conversationId,
                reviewNotifiedExperts: json.notifiedExperts ?? 0,
              }
            : turn,
        ),
      );
    } catch (error) {
      setTurns((t) =>
        t.map((turn) =>
          turn.result?.queryId === queryId
            ? {
                ...turn,
                reviewPending: false,
                reviewError: error instanceof Error ? error.message : "Impossible de demander une validation.",
              }
            : turn,
        ),
      );
    }
  }

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setQuestion("");
    setTurns((t) => [...t, { question: q }]);
    try {
      const res = await fetch("/api/griot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? res.ok
              ? { ...turn, result: json }
              : { ...turn, error: json.error ?? "Le Griot n'a pas pu répondre." }
            : turn,
        ),
      );
    } catch {
      setTurns((t) =>
        t.map((turn, i) => (i === t.length - 1 ? { ...turn, error: "Impossible de joindre le Griot. Réessaie dans un instant." } : turn)),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {historyUnavailable && <p className="mt-6 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">L’historique n’a pas pu être chargé.</p>}
      {historyItems.length > 0 && (
        <details className="mt-6 rounded-xl border border-border bg-surface p-4">
          <summary className="cursor-pointer font-medium">Historique privé ({historyItems.length} échanges chargés)</summary>
          <ol className="mt-4 space-y-4">
            {historyItems.map((item) => (
              <li key={item.id} className="border-t border-border pt-3">
                <p className="text-xs text-muted">
                  {new Date(item.created_at).toLocaleString("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Porto-Novo",
                  })}
                </p>
                <p className="mt-1 font-medium">{item.question}</p>
                {item.answer && <div className="mt-2 text-sm"><Markdown text={item.answer} /></div>}
                {item.escalated_conversation_id && (
                  <Link href={`/discussions/${item.escalated_conversation_id}`} className="mt-2 inline-block text-sm text-primary hover:underline">
                    Ouvrir la discussion publique →
                  </Link>
                )}
                {!item.escalated_conversation_id && item.escalated_question_id && (
                  <Link href={`/questions/${item.escalated_question_id}`} className="mt-2 inline-block text-sm text-primary hover:underline">
                    Ouvrir la demande publique →
                  </Link>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">
            Ces échanges restent privés. Seules les demandes d’avis que tu confirmes sont publiées dans Discussions.
          </p>
          {historyHasMore && (
            <button
              onClick={loadMoreHistory}
              disabled={historyLoading}
              className="mt-4 text-sm text-primary hover:underline disabled:opacity-50"
            >
              {historyLoading ? "Chargement…" : "Charger les échanges plus anciens"}
            </button>
          )}
          {historyError && <p className="mt-2 text-sm text-primary">{historyError}</p>}
        </details>
      )}
      {turns.length === 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => ask(e)} className="rounded-full border border-border bg-surface px-4 py-2 text-left text-sm hover:border-primary">
              {e}
            </button>
          ))}
        </div>
      )}

      <ol className="mt-6 space-y-6">
        {turns.map((turn, i) => (
          <li key={i} className="space-y-3">
            <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-primary-ink">{turn.question}</p>
            {turn.error && <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm text-primary">{turn.error}</p>}
            {!turn.result && !turn.error && <p className="animate-pulse text-sm text-muted">Le Griot vérifie les sources pertinentes et prépare sa réponse…</p>}
            {turn.result && (
              <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-border bg-surface p-4">
                {turn.result.answerOrigin === "zai" && (
                  <p className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-muted">
                    Réponse générée par le Griot, sans validation de la communauté. Elle peut nécessiter un avis d’expert.
                  </p>
                )}
                {turn.result.answerOrigin === "community" && (
                  <p className="mb-3 text-xs text-muted">Réponse fondée sur des contributions de la communauté.</p>
                )}
                <Markdown text={turn.result.answer} />
                {turn.result.sources.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Sources de la communauté</p>
                    <ol className="mt-2 space-y-1.5 text-sm">
                      {turn.result.sources.map((s, n) => (
                        <li key={s.answer_id} id={`source-${n + 1}`} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono text-xs text-primary">[{n + 1}]</span>
                          <Link href={`/questions/${s.question_id}`} className="hover:text-primary">
                            {s.question_title}
                          </Link>
                          <span className="text-muted">
                            par{" "}
                            <Link href={`/u/${s.author_username}`} className="text-foreground">
                              @{s.author_username}
                            </Link>
                            {s.author_city && `, ${s.author_city}`}
                          </span>
                          <span className="rounded bg-leaf/10 px-1.5 text-xs font-medium text-leaf">+5 XP</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {turn.result.answerOrigin === "zai" && !turn.reviewConversationId && (
                  <div className="mt-4 border-t border-border pt-3">
                    <label className="flex items-start gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={Boolean(turn.reviewConsent)}
                        onChange={(event) =>
                          setTurns((t) =>
                            t.map((item) =>
                              item.result?.queryId === turn.result?.queryId
                                ? { ...item, reviewConsent: event.target.checked }
                                : item,
                            ),
                          )
                        }
                        className="mt-1"
                      />
                      <span>
                        Je comprends que ma question et la réponse du Griot seront publiées dans un sujet public des Discussions, visible par toute la communauté.
                      </span>
                    </label>
                    <button
                      onClick={() => requestExpertReview(turn.result!.queryId)}
                      disabled={turn.reviewPending || !turn.reviewConsent}
                      className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink disabled:opacity-50"
                    >
                      {turn.reviewPending ? "Publication…" : "Publier dans Discussions et demander un avis"}
                    </button>
                    {turn.reviewError && <p className="mt-2 text-sm text-primary">{turn.reviewError}</p>}
                  </div>
                )}
                {turn.reviewConversationId && (
                  <div className="mt-4">
                    <p className="text-sm text-muted">
                      {turn.reviewNotifiedExperts
                        ? `${turn.reviewNotifiedExperts} expert(s) de niveau Expert ont reçu une notification dans Baobab Dev.`
                        : "Le sujet est public, mais aucun membre de niveau Expert n’est disponible pour recevoir une notification."}
                    </p>
                    <Link href={`/discussions/${turn.reviewConversationId}`} className="mt-1 inline-block text-sm text-primary hover:underline">
                      Ouvrir la discussion publique →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="sticky bottom-4 mt-6 flex gap-2 rounded-full border border-border bg-surface p-1.5 shadow-sm"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pose ta question au Griot…"
          className="flex-1 bg-transparent px-3 outline-none"
        />
        <button disabled={loading} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink disabled:opacity-50">
          Demander
        </button>
      </form>
    </div>
  );
}
