"use client";

import { dateLocale } from "@/lib/i18n/current";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import Image from "next/image";
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
  {
    icon: "💳",
    label: "Paiement",
    question: "Comment intégrer FedaPay dans Laravel et vérifier les webhooks ?",
  },
  {
    icon: "📱",
    label: "Mobile Money",
    question: "Mes paiements Kkiapay restent en pending, pourquoi ?",
  },
  {
    icon: "📡",
    label: "USSD",
    question: "Comment gérer les sessions d'un menu USSD en Node.js ?",
  },
];

const TIME_ZONE = "Africa/Porto-Novo";

function monthForDate(date: string) {
  const parts = new Intl.DateTimeFormat(dateLocale(), {
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).formatToParts(new Date(date));
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  return { key: `${year}-${month}`, label: `${month}/${year}` };
}

function relativeDate(iso: string) {
  return new Date(iso).toLocaleString(dateLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  });
}

/* ── Composant avatar inline du Griot ── */
function GriotMiniAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full ring-1 ring-primary/30"
      style={{ width: size, height: size }}
    >
      <Image
        src="/griot-avatar.jpg"
        alt=""
        fill
        sizes={`${size}px`}
        className="object-cover object-[50%_42%]"
      />
    </div>
  );
}

/* ────────────────────────────────────────── */
/* ──           GriotChat principal        ── */
/* ────────────────────────────────────────── */

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
  const tr = useT();
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

  /* ── Auto-resize textarea ── */
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

  /* ── Restore draft from session ── */
  useEffect(() => {
    if (!isPage) return;
    const draft = window.sessionStorage.getItem("griot-draft");
    if (draft) {
      setQuestion(draft);
      window.sessionStorage.removeItem("griot-draft");
    }
  }, [isPage]);

  /* ── Conversation memoization ── */
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

  /* ── Load more history ── */
  async function loadMoreHistory() {
    if (historyLoading || !historyHasMore) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/griot?offset=${historyItems.length}`);
      const json = (await res.json()) as { history?: GriotHistoryItem[]; hasMore?: boolean; error?: string };
      if (!res.ok || !Array.isArray(json.history)) throw new Error(json.error ?? "Impossible de charger l'historique.");
      const nextHistory = json.history;
      setHistoryItems((items) => [...items, ...nextHistory]);
      setHistoryHasMore(Boolean(json.hasMore));
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Impossible de charger l'historique.");
    } finally {
      setHistoryLoading(false);
    }
  }

  /* ── Expert review ── */
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

  /* ── Ask question ── */
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

  /* ─────────────────────────────────────── */
  /* ──      Rendu : mode bulle (mini)     ── */
  /* ─────────────────────────────────────── */
  if (!isPage) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="griot-chat-bubble min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
          {historyUnavailable && (
            <p className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tr("L'historique n'a pas pu être chargé.")}</p>
          )}
          {turns.length === 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-muted">{tr("Essaie une question :")}</p>
              {EXAMPLES.map((e) => (
                <button
                  key={e.question}
                  onClick={() => ask(e.question)}
                  className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm transition hover:border-primary/50 hover:bg-surface-hover"
                >
                  <span className="text-base">{e.icon}</span>
                  <span className="line-clamp-2">{e.question}</span>
                </button>
              ))}
            </div>
          )}
          {turns.length > 0 && (
            <ol className="mt-2 min-w-0 space-y-3">
              {turns.map((turn, i) => (
                <li key={i} className="min-w-0 space-y-2 break-words">
                  {/* Question utilisateur */}
                  <div className="flex justify-end">
                    <p className="max-w-[88%] break-words rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-ink">
                      {turn.question}
                    </p>
                  </div>
                  {/* Erreur */}
                  {turn.error && (
                    <p className="break-words rounded-2xl bg-danger/10 px-3 py-2 text-sm text-danger">{turn.error}</p>
                  )}
                  {/* Thinking */}
                  {!turn.result && !turn.error && (
                    <div className="flex items-start gap-2">
                      <GriotMiniAvatar size={24} />
                      <p className="griot-thinking flex items-center gap-2 rounded-2xl rounded-tl-sm border border-violet/20 bg-violet/5 px-3 py-2 text-sm text-muted" role="status">
                        <span className="griot-thinking-dots flex gap-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        </span>
                        {tr("Réflexion…")}
                      </p>
                    </div>
                  )}
                  {/* Réponse */}
                  {turn.result && (
                    <div className="flex items-start gap-2">
                      <GriotMiniAvatar size={24} />
                      <div className="min-w-0 max-w-[92%] overflow-hidden rounded-2xl rounded-tl-sm border border-border bg-surface p-3 text-sm">
                        <Markdown text={turn.result.answer} />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Input bulle */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="mx-2 mb-2 flex shrink-0 items-end gap-2 rounded-2xl border border-primary/20 bg-background/90 p-2 shadow-sm backdrop-blur"
        >
          <textarea
            ref={questionTextareaRef}
            rows={1}
            value={question}
            onChange={(e) => updateQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            placeholder={tr("Ta question…")}
            aria-label={tr("Ta question au Griot")}
            className="h-11 min-h-11 min-w-0 flex-1 resize-none break-words rounded-xl bg-surface/70 px-3 py-2 text-sm leading-5 outline-none transition placeholder:text-muted/70 focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <button
            disabled={loading || !question.trim()}
            className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-3 text-primary-ink shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={tr("Envoyer")}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 0 0-1.788 0l-7 14a1 1 0 0 0 1.169 1.409l5-1.429A1 1 0 0 0 9 15.571V11a1 1 0 1 1 2 0v4.571a1 1 0 0 0 .725.962l5 1.428a1 1 0 0 0 1.17-1.408l-7-14Z" />
            </svg>
          </button>
        </form>
      </div>
    );
  }

  /* ─────────────────────────────────────── */
  /* ──     Rendu : mode page complet      ── */
  /* ─────────────────────────────────────── */
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 sm:px-6">
        {/* ── Timeline sidebar + contenu ── */}
        <div className={`relative ${months.length > 0 ? "grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-5" : ""}`}>

          {/* Timeline verticale */}
          {months.length > 0 && (
            <aside className="sticky top-16 col-start-1 row-start-1 flex h-[min(40vh,20rem)] min-h-44 flex-col items-center gap-1.5 self-start pt-4 sm:h-[min(60vh,32rem)] sm:gap-2" aria-label={tr("Frise chronologique")}>
              <span className="hidden rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted sm:block">
                {months[activeMonthIndex]?.label}
              </span>
              <div className="relative flex min-h-0 flex-1 items-center justify-center">
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-primary/30 via-muted/20 to-transparent" aria-hidden="true" />
                {months.map((month, index) => (
                  <span
                    key={month.key}
                    className={`absolute left-1/2 -translate-x-1/2 transition-all duration-300 ${
                      index === activeMonthIndex
                        ? "h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
                        : "h-1.5 w-1.5 rounded-full bg-muted/40"
                    }`}
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
                  aria-label={tr("Naviguer entre les mois de l'historique")}
                  aria-valuetext={months[activeMonthIndex]?.label}
                  className="griot-timeline-range relative z-10 h-full w-5 disabled:opacity-70"
                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                />
              </div>
              <span className="hidden rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted sm:block">
                {months[0]?.label}
              </span>
            </aside>
          )}

          {/* ── Contenu principal ── */}
          <div className={`min-w-0 pt-4 ${months.length > 0 ? "col-start-2 row-start-1" : ""}`}>
            {historyUnavailable && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" /></svg>
                {tr("L'historique n'a pas pu être chargé.")}
              </div>
            )}

            {/* Charger plus */}
            {historyHasMore && (
              <button
                onClick={loadMoreHistory}
                disabled={historyLoading}
                className="mb-4 flex items-center gap-2 text-sm font-medium text-primary transition hover:underline disabled:opacity-50"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd" /></svg>
                {historyLoading ? tr("Chargement…") : tr("Charger les échanges plus anciens")}
              </button>
            )}
            {historyError && <p className="mb-3 text-sm text-danger">{historyError}</p>}

            {/* Notice privée */}
            {historyItems.length > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-border/60 bg-surface/50 px-3 py-2 text-xs text-muted">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor"><path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" /></svg>
                {tr("Ces échanges restent privés. Seules les demandes d'avis que tu confirmes sont publiées.")}
              </div>
            )}

            {/* ── Empty state ── */}
            {conversation.length === 0 && turns.length === 0 && (
              <div className="flex flex-col items-center gap-6 py-12 text-center">
                <div className="space-y-2">
                  <p className="text-lg font-semibold">{tr("Pose ta première question")}</p>
                  <p className="text-sm text-muted">{tr("Le Griot puise dans la sagesse collective de Baobab Dev")}</p>
                </div>
                <div className="grid w-full max-w-lg gap-3 sm:grid-cols-3">
                  {EXAMPLES.map((e) => (
                    <button
                      key={e.question}
                      onClick={() => ask(e.question)}
                      className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface/60 p-4 text-left transition hover:border-primary/40 hover:bg-surface hover:shadow-md"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl transition group-hover:bg-primary/15 group-hover:scale-110">
                        {e.icon}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">{e.label}</span>
                      <span className="text-sm leading-snug text-muted group-hover:text-foreground">{e.question}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Historique rendu ── */}
            {historyItems.length > 0 && (
              <ol className="min-w-0 space-y-5">
                {historyItems
                  .slice()
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((item) => {
                    const month = monthForDate(item.created_at);
                    const anchor = monthAnchorKeys.has(`history-${item.id}`);
                    return (
                      <Fragment key={item.id}>
                        {anchor && (
                          <li
                            id={`griot-month-${month.key}`}
                            data-griot-month
                            className="scroll-mt-20 list-none"
                          >
                            <span className="inline-flex items-center rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs text-muted">
                              {month.label}
                            </span>
                          </li>
                        )}
                        <li className="min-w-0 space-y-3 break-words">
                          {/* Date */}
                          <p className="text-xs text-muted/70">{relativeDate(item.created_at)}</p>
                          {/* Question utilisateur */}
                          <div className="flex justify-end">
                            <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-ink shadow-sm">
                              {item.question}
                            </p>
                          </div>
                          {/* Réponse Griot */}
                          {item.answer && (
                            <div className="flex items-start gap-2.5">
                              <GriotMiniAvatar size={30} />
                              <div className="min-w-0 max-w-[90%] rounded-2xl rounded-tl-sm border border-border/80 bg-surface/80 p-4 text-sm shadow-sm backdrop-blur-sm">
                                <Markdown text={item.answer} />
                              </div>
                            </div>
                          )}
                          {/* Lien discussion */}
                          {item.escalated_conversation_id && (
                            <div className="ml-10">
                              <Link href={`/discussions/${item.escalated_conversation_id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378c.635 1.19-.167 2.575-1.543 2.575H1.918c-1.376 0-2.178-1.385-1.543-2.575L6.457 1.047z"/></svg>
                                {tr("Ouvrir la discussion publique →")}
                              </Link>
                            </div>
                          )}
                          {!item.escalated_conversation_id && item.escalated_question_id && (
                            <div className="ml-10">
                              <Link href={`/questions/${item.escalated_question_id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                                {tr("Ouvrir la demande publique →")}
                              </Link>
                            </div>
                          )}
                        </li>
                      </Fragment>
                    );
                  })}
              </ol>
            )}

            {/* ── Turns en direct ── */}
            <ol className="mt-5 min-w-0 space-y-6">
              {turns.map((turn, i) => {
                const month = monthForDate(turn.createdAt);
                const anchor = monthAnchorKeys.has(`turn-${i}`);
                return (
                  <Fragment key={`turn-${i}`}>
                    {anchor && (
                      <li
                        id={`griot-month-${month.key}`}
                        data-griot-month
                        className="scroll-mt-20 list-none"
                      >
                        <span className="inline-flex items-center rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs text-muted">
                          {month.label}
                        </span>
                      </li>
                    )}
                    <li className="min-w-0 space-y-3 break-words">
                      {/* Question utilisateur */}
                      <div className="flex justify-end">
                        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-ink shadow-sm">
                          {turn.question}
                        </p>
                      </div>

                      {/* Erreur */}
                      {turn.error && (
                        <div className="flex items-start gap-2.5">
                          <GriotMiniAvatar size={30} />
                          <p className="rounded-2xl rounded-tl-sm border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                            {turn.error}
                          </p>
                        </div>
                      )}

                      {/* Thinking / chargement */}
                      {!turn.result && !turn.error && (
                        <div className="flex items-start gap-2.5">
                          <GriotMiniAvatar size={30} />
                          <div className="griot-thinking flex items-center gap-3 rounded-2xl rounded-tl-sm border border-violet/20 bg-violet/5 px-4 py-3 text-sm text-muted" role="status">
                            <span className="griot-thinking-dots flex gap-1">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            </span>
                            {tr("Le Griot vérifie les sources et prépare sa réponse…")}
                          </div>
                        </div>
                      )}

                      {/* Réponse complète */}
                      {turn.result && (
                        <div className="flex items-start gap-2.5">
                          <GriotMiniAvatar size={30} />
                          <div className="min-w-0 max-w-[90%] space-y-3 rounded-2xl rounded-tl-sm border border-border/80 bg-surface/80 p-4 text-sm shadow-sm backdrop-blur-sm">
                            {/* Badge origine */}
                            {turn.result.answerOrigin === "zai" && (
                              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z M8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>
                                {tr("Réponse IA — non validée par la communauté")}
                              </div>
                            )}
                            {turn.result.answerOrigin === "community" && (
                              <div className="flex items-center gap-2 rounded-lg bg-leaf/10 px-3 py-2 text-xs text-leaf">
                                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
                                {tr("Fondée sur des contributions de la communauté")}
                              </div>
                            )}

                            {/* Corps */}
                            <Markdown text={turn.result.answer} />

                            {/* Sources */}
                            {turn.result.sources.length > 0 && (
                              <div className="border-t border-border/70 pt-3">
                                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M3.75 0a.75.75 0 0 1 .75.75V2h7V.75a.75.75 0 0 1 1.5 0V2h.25A1.75 1.75 0 0 1 15 3.75v8.5A1.75 1.75 0 0 1 13.25 14H2.75A1.75 1.75 0 0 1 1 12.25v-8.5A1.75 1.75 0 0 1 2.75 2H3V.75A.75.75 0 0 1 3.75 0Z"/></svg>
                                  {tr("Sources de la communauté")}
                                </p>
                                <ol className="mt-2.5 space-y-2 text-sm">
                                  {turn.result.sources.map((s, n) => (
                                    <li key={s.answer_id} id={`source-${n + 1}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-bold text-primary">
                                        {n + 1}
                                      </span>
                                      <Link href={`/questions/${s.question_id}`} className="font-medium hover:text-primary hover:underline">
                                        {s.question_title}
                                      </Link>
                                      <span className="text-muted">
                                        {tr("par")}{" "}
                                        <Link href={`/u/${s.author_username}`} className="font-medium text-foreground hover:text-primary">
                                          @{s.author_username}
                                        </Link>
                                        {s.author_city && `, ${s.author_city}`}
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-leaf/10 px-2 py-0.5 text-xs font-bold text-leaf">
                                        {tr("+5 XP")}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Demande d'avis expert */}
                            {turn.result.answerOrigin === "zai" && !turn.reviewConversationId && (
                              <div className="border-t border-border/70 pt-3">
                                <label className="flex items-start gap-2.5 text-sm text-muted">
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
                                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                                  />
                                  <span className="leading-snug">
                                    {tr("Je comprends que ma question et la réponse seront publiées dans un sujet public des Discussions.")}
                                  </span>
                                </label>
                                <button
                                  onClick={() => requestExpertReview(turn.result!.queryId)}
                                  disabled={turn.reviewPending || !turn.reviewConsent}
                                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-ink shadow-sm transition hover:brightness-105 disabled:opacity-50"
                                >
                                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor"><path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-9 8c0-2.5 2.5-4 5-4s5 1.5 5 4v.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V14z"/></svg>
                                  {turn.reviewPending ? tr("Publication…") : tr("Demander un avis d'expert")}
                                </button>
                                {turn.reviewError && <p className="mt-2 text-sm text-danger">{turn.reviewError}</p>}
                              </div>
                            )}

                            {/* Avis envoyé */}
                            {turn.reviewConversationId && (
                              <div className="border-t border-border/70 pt-3">
                                <div className="flex items-center gap-2 rounded-lg bg-leaf/10 px-3 py-2 text-sm text-leaf">
                                  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
                                  {turn.reviewNotifiedExperts
                                    ? `${turn.reviewNotifiedExperts} expert(s) notifié(s)`
                                    : tr("Sujet publié — aucun expert disponible pour notification")}
                                </div>
                                <Link
                                  href={`/discussions/${turn.reviewConversationId}`}
                                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                                >
                                  {tr("Ouvrir la discussion publique →")}
                                </Link>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  </Fragment>
                );
              })}
              <li ref={endOfConversationRef} aria-hidden="true" className="h-px list-none" />
            </ol>
          </div>
        </div>
      </div>

      {/* ── Input bar fixe en bas ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-background/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2.5 px-4 py-3 sm:px-6">
          <textarea
            ref={questionTextareaRef}
            rows={1}
            value={question}
            onChange={(e) => updateQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            placeholder={tr("Décris ton problème ou colle un extrait de code…")}
            aria-label={tr("Ta question au Griot")}
            className="h-11 min-h-11 min-w-0 flex-1 resize-none break-words rounded-xl border border-border/80 bg-surface/80 px-4 py-2.5 text-sm leading-5 outline-none transition placeholder:text-muted/60 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <button
            disabled={loading || !question.trim()}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
          >
            <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 0 0-1.788 0l-7 14a1 1 0 0 0 1.169 1.409l5-1.429A1 1 0 0 0 9 15.571V11a1 1 0 1 1 2 0v4.571a1 1 0 0 0 .725.962l5 1.428a1 1 0 0 0 1.17-1.408l-7-14Z" />
            </svg>
            <span className="hidden sm:inline">{tr("Demander")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
