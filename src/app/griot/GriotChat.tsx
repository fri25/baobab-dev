"use client";

import Link from "next/link";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { GriotResult } from "@/lib/griot";

type Turn = {
  question: string;
  createdAt: string;
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

const TIME_ZONE = "Africa/Porto-Novo";

function monthForDate(date: string) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).formatToParts(new Date(date));
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  return { key: `${year}-${month}`, label: `${month}/${year}` };
}

export function GriotChat({
  history,
  historyHasMore: initialHistoryHasMore,
  historyUnavailable,
  presentation = "page",
  onDraftChange,
}: {
  history: GriotHistoryItem[];
  historyHasMore: boolean;
  historyUnavailable: boolean;
  presentation?: "page" | "bubble";
  onDraftChange?: (draft: string) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [historyItems, setHistoryItems] = useState(history);
  const [historyHasMore, setHistoryHasMore] = useState(initialHistoryHasMore);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const isPage = presentation === "page";
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const endOfConversationRef = useRef<HTMLLIElement>(null);
  const didInitialScroll = useRef(false);

  useLayoutEffect(() => {
    const textarea = questionTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "44px";
    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
    const verticalPadding =
      Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
    const maxHeight = lineHeight * 7 + verticalPadding;
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.max(44, Math.min(contentHeight, maxHeight))}px`;
    textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [question]);

  useEffect(() => {
    if (!isPage) return;
    const draft = window.sessionStorage.getItem("griot-draft");
    if (draft) {
      setQuestion(draft);
      window.sessionStorage.removeItem("griot-draft");
    }
  }, [isPage]);

  const conversation = useMemo(() => {
    const items = [
      ...(isPage
        ? historyItems.map((item) => ({ kind: "history" as const, item, createdAt: item.created_at }))
        : []),
      ...turns.map((item, index) => ({ kind: "turn" as const, item, index, createdAt: item.createdAt })),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    let previousMonth = "";
    return items.map((item) => {
      const month = monthForDate(item.createdAt);
      const startsMonth = month.key !== previousMonth;
      previousMonth = month.key;
      const anchorKey = item.kind === "history" ? `history-${item.item.id}` : `turn-${item.index}`;
      return { ...item, month, startsMonth, anchorKey };
    });
  }, [historyItems, isPage, turns]);

  const months = useMemo(
    () => conversation.filter((item) => item.startsMonth).map((item) => item.month),
    [conversation],
  );
  const monthAnchorKeys = useMemo(
    () => new Set(conversation.filter((item) => item.startsMonth).map((item) => item.anchorKey)),
    [conversation],
  );
  const [activeMonthIndex, setActiveMonthIndex] = useState(0);

  useEffect(() => {
    setActiveMonthIndex((index) => Math.min(index, Math.max(months.length - 1, 0)));
  }, [months.length]);

  useEffect(() => {
    if (!isPage || months.length < 2) return;
    const updateActiveMonth = () => {
      let activeIndex = 0;
      months.forEach((month, index) => {
        const element = document.getElementById(`griot-month-${month.key}`);
        if (element && element.getBoundingClientRect().top <= 180) activeIndex = index;
      });
      setActiveMonthIndex(activeIndex);
    };
    window.addEventListener("scroll", updateActiveMonth, { passive: true });
    updateActiveMonth();
    return () => window.removeEventListener("scroll", updateActiveMonth);
  }, [isPage, months]);

  useEffect(() => {
    if (!isPage || conversation.length === 0 || didInitialScroll.current) return;
    endOfConversationRef.current?.scrollIntoView({ block: "end" });
    didInitialScroll.current = true;
  }, [conversation.length, isPage]);

  useEffect(() => {
    if (isPage && turns.length > 0) {
      endOfConversationRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isPage, turns.length]);

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
    onDraftChange?.("");
    setTurns((t) => [...t, { question: q, createdAt: new Date().toISOString() }]);
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

  function updateQuestion(value: string) {
    setQuestion(value);
    onDraftChange?.(value);
  }

  function jumpToMonth(index: number) {
    const month = months[index];
    if (!month) return;
    setActiveMonthIndex(index);
    document.getElementById(`griot-month-${month.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={isPage ? "relative grid grid-cols-[2rem_minmax(0,1fr)] gap-2 pb-24 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-6" : "flex min-h-0 min-w-0 flex-1 flex-col"}>
      {isPage && months.length > 0 && (
        <aside className="sticky top-24 col-start-1 row-start-1 flex h-[min(35vh,16rem)] min-h-40 flex-col items-center gap-1 self-start sm:h-[min(60vh,34rem)] sm:min-h-48 sm:gap-2" aria-label="Frise chronologique de l’historique">
          <span className="hidden font-mono text-[10px] text-muted sm:block">{months[activeMonthIndex]?.label}</span>
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted/25" aria-hidden="true" />
            {months.map((month, index) => (
              <span
                key={month.key}
                className={`absolute left-1/2 h-px -translate-x-1/2 ${index === activeMonthIndex ? "w-3 bg-primary" : "w-2 bg-muted/40"}`}
                style={{ top: `${months.length === 1 ? 50 : (index / (months.length - 1)) * 100}%` }}
                aria-hidden="true"
              />
            ))}
            <input
              type="range"
              min={0}
              max={Math.max(months.length - 1, 0)}
              step={1}
              value={activeMonthIndex}
              onChange={(event) => jumpToMonth(Number(event.target.value))}
              disabled={months.length < 2}
              aria-label="Naviguer entre les mois de l’historique"
              aria-valuetext={months[activeMonthIndex]?.label}
              className="griot-timeline-range relative z-10 h-full w-5 disabled:opacity-70"
              style={{ writingMode: "vertical-lr", direction: "rtl" }}
            />
          </div>
          <span className="hidden font-mono text-[10px] text-muted sm:block">{months[0]?.label}</span>
        </aside>
      )}
      <div className={isPage ? "col-start-2 row-start-1 min-w-0" : "flex min-h-0 min-w-0 flex-1 flex-col"}>
        {!isPage && (
          <div className="griot-chat-bubble min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-1">
            {historyUnavailable && <p className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">L’historique n’a pas pu être chargé.</p>}
            {turns.length === 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => ask(e)} className="max-w-full break-words rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm hover:border-primary">
                    {e}
                  </button>
                ))}
              </div>
            )}
            {turns.length > 0 && (
              <ol className="mt-4 min-w-0 space-y-4">
                {turns.map((turn, i) => (
                  <li key={i} className="min-w-0 space-y-3 break-words">
                    <p className="ml-auto max-w-[90%] break-words rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-ink">{turn.question}</p>
                    {turn.error && <p className="break-words rounded-2xl bg-primary/10 px-3 py-3 text-sm text-primary">{turn.error}</p>}
                    {!turn.result && !turn.error && (
                      <p className="griot-thinking flex items-center gap-2 rounded-xl border border-violet/20 bg-violet/5 px-3 py-2 text-sm text-muted" role="status">
                        <span className="h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
                        Le Griot prépare sa réponse…
                      </p>
                    )}
                    {turn.result && <div className="min-w-0 max-w-full overflow-hidden rounded-2xl rounded-bl-sm border border-border bg-surface p-3 text-sm"><Markdown text={turn.result.answer} /></div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {isPage && historyUnavailable && <p className="mt-6 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">L’historique n’a pas pu être chargé.</p>}
        {isPage && historyHasMore && (
          <button
            onClick={loadMoreHistory}
            disabled={historyLoading}
            className="mb-4 text-left text-sm text-primary hover:underline disabled:opacity-50"
          >
            {historyLoading ? "Chargement…" : "Charger les échanges plus anciens"}
          </button>
        )}
        {isPage && historyError && <p className="mb-3 text-sm text-primary">{historyError}</p>}
        {isPage && historyItems.length > 0 && (
          <p className="mb-3 text-xs text-muted">
            Ces échanges restent privés. Seules les demandes d’avis que tu confirmes sont publiées dans Discussions.
          </p>
        )}
        {isPage && conversation.length === 0 && turns.length === 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => ask(e)} className="max-w-full break-words rounded-xl border border-border bg-surface px-4 py-2 text-left text-sm hover:border-primary">
                {e}
              </button>
            ))}
          </div>
        )}
        {isPage && (
          <ol className="mt-2 min-w-0 space-y-6">
            {historyItems
              .slice()
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((item) => {
                const month = monthForDate(item.created_at);
                const anchor = monthAnchorKeys.has(`history-${item.id}`);
                return (
                  <Fragment key={item.id}>
                    {anchor && <li id={`griot-month-${month.key}`} data-griot-month className="scroll-mt-24 list-none border-b border-border/70 pb-1 font-mono text-xs text-muted">{month.label}</li>}
                    <li className="min-w-0 space-y-2 break-words border-t border-border/70 pt-3">
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
                  </Fragment>
                );
              })}
          </ol>
        )}
        {isPage && (
          <ol className="mt-6 min-w-0 space-y-6">
            {turns.map((turn, i) => {
              const month = monthForDate(turn.createdAt);
              const anchor = monthAnchorKeys.has(`turn-${i}`);
              return (
                <Fragment key={`turn-${i}`}>
                  {anchor && <li id={`griot-month-${month.key}`} data-griot-month className="scroll-mt-24 list-none border-b border-border/70 pb-1 font-mono text-xs text-muted">{month.label}</li>}
                  <li className="min-w-0 space-y-3 break-words">
            <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-primary-ink">{turn.question}</p>
            {turn.error && <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm text-primary">{turn.error}</p>}
            {!turn.result && !turn.error && (
              <p className="griot-thinking flex items-center gap-2 rounded-2xl border border-violet/20 bg-violet/5 px-4 py-3 text-sm text-muted" role="status">
                <span className="h-2.5 w-2.5 rounded-full bg-gold" aria-hidden="true" />
                Le Griot vérifie les sources pertinentes et prépare sa réponse…
              </p>
            )}
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
                </Fragment>
              );
            })}
            <li ref={endOfConversationRef} aria-hidden="true" className="h-px list-none" />
          </ol>
        )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className={`${
          isPage
            ? "fixed bottom-3 left-1/2 z-30 flex w-[min(48rem,calc(100vw-1.5rem))] -translate-x-1/2 items-end gap-2 rounded-3xl border border-border/70 bg-background/75 p-2 shadow-xl backdrop-blur-xl sm:bottom-5"
            : "mx-2 mb-2 flex shrink-0 items-end gap-2 rounded-2xl border border-primary/20 bg-background/90 p-2 shadow-sm backdrop-blur"
        }`}
      >
        <textarea
          ref={questionTextareaRef}
          rows={1}
          value={question}
          onChange={(e) => updateQuestion(e.target.value)}
          placeholder="Décris ton problème ou colle un extrait de code…"
          aria-label="Ta question au Griot"
          className="h-11 min-h-11 min-w-0 flex-1 resize-none break-words rounded-xl bg-surface/70 px-3 py-2 text-sm leading-5 outline-none transition placeholder:text-muted/80 focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        <button
          disabled={loading || !question.trim()}
          className="flex h-11 shrink-0 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
        >
          Demander
        </button>
      </form>
      </div>
    </div>
  );
}
