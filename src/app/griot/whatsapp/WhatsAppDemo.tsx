"use client";

import { dateLocale } from "@/lib/i18n/current";
import { useT } from "@/lib/i18n/client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import type { GriotResult } from "@/lib/griot";

type Bubble = { me: boolean; text: string; time: string; sources?: GriotResult["sources"] };

const now = () => new Date().toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });

const SUGGESTIONS = [
  "Comment intégrer FedaPay dans Laravel ?",
  "Mes paiements Kkiapay restent en pending",
  "Comment gérer les sessions USSD en Node.js ?",
];

// Rendu au format WhatsApp : *gras*, ```code```, [liens sources]
function WaText({ text, sources = [] }: { text: string; sources?: GriotResult["sources"] }) {
  return (
    <>
      {text.split(/(```[\s\S]*?```|\*[^*\n]+\*|\[\d+\])/g).map((part, i) => {
        const citation = /^\[(\d+)\]$/.exec(part);
        const source = citation ? sources[Number(citation[1]) - 1] : undefined;
        if (source) {
          return (
            <Link key={i} href={`/questions/${source.question_id}`} className="font-semibold text-emerald-700 underline dark:text-emerald-400">
              {part}
            </Link>
          );
        }
        if (part.startsWith("```")) {
          return (
            <code key={i} className="my-1.5 block whitespace-pre-wrap rounded-md bg-black/10 p-2 font-mono text-[11px] text-zinc-800 dark:bg-black/30 dark:text-zinc-200">
              {part.slice(3, -3).replace(/^\w*\n/, "")}
            </code>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) return <strong key={i} className="font-bold">{part.slice(1, -1)}</strong>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Simulation fidèle de la conversation WhatsApp (même moteur que le webhook /api/whatsapp)
export function WhatsAppDemo() {
  const t = useT();
  const [bubbles, setBubbles] = useState<Bubble[]>([
    { me: false, text: "Bonjour ! Je suis le Griot de Baobab Dev 🌳 Pose-moi ta question de code, bug ou architecture.", time: now() },
  ]);
  const [draft, setDraft] = useState("Comment intégrer FedaPay dans Laravel ?");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, typing]);

  async function send(query?: string) {
    const q = (query ?? draft).trim();
    if (!q || typing) return;
    setDraft("");
    setBubbles((b) => [...b, { me: true, text: q, time: now() }]);
    setTyping(true);
    try {
      const res = await fetch("/api/griot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, channel: "whatsapp" }),
      });
      const json = (await res.json()) as GriotResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Le Griot n'a pas pu répondre.");
      let text = json.answer.replace(/\*\*([^*]+)\*\*/g, "*$1*");
      if (json.answerOrigin === "zai") {
        text += "\n\n⚠️ Réponse du Griot, non validée par la communauté.";
        text += "\nPour demander l'avis d'un expert, publie la question sur Baobab Dev.";
      }
      setBubbles((b) => [...b, { me: false, text, time: now(), sources: json.sources }]);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Impossible de joindre le Griot. Réessaie dans un instant.";
      setBubbles((b) => [...b, { me: false, text, time: now() }]);
    } finally {
      setTyping(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      {/* Suggestions rapides */}
      <div className="mb-3 flex max-w-[360px] flex-wrap justify-center gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setDraft(s);
              send(s);
            }}
            disabled={typing}
            className="rounded-full border border-border/80 bg-surface/80 px-2.5 py-1 text-xs text-muted transition hover:border-primary hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Châssis smartphone moderne */}
      <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-[2.5rem] border-[10px] border-zinc-900 bg-[#efeae2] shadow-2xl ring-1 ring-zinc-800 dark:border-zinc-800 dark:bg-[#0b141a]">
        {/* Dynamic Island / Notch supérieur */}
        <div className="absolute left-1/2 top-2 z-20 h-4 w-24 -translate-x-1/2 rounded-full bg-black" />

        {/* Header WhatsApp vert officiel */}
        <div className="relative z-10 flex items-center justify-between bg-[#075e54] px-4 pb-3 pt-7 text-white dark:bg-[#1f2c34]">
          <div className="flex items-center gap-2.5">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-white/40">
              <Image
                src="/griot-avatar.jpg"
                alt={t("Avatar du Griot")}
                fill
                sizes="40px"
                className="object-cover object-[50%_42%]"
              />
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-sm tracking-wide">{t("Griot · Baobab Dev")}</p>
              <p className="text-[11px] text-emerald-200">
                {typing ? (
                  <span className="flex items-center gap-1 font-medium text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    {t("écrit une réponse…")}
                  </span>
                ) : (
                  t("en ligne (bot certifié)")
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-white/80">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-7v4h4l-5 7z" />
            </svg>
          </div>
        </div>

        {/* Fil de discussion */}
        <ol className="h-[460px] space-y-2.5 overflow-y-auto p-3 text-[13px] leading-relaxed text-[#111b21] dark:text-[#e9edef]">
          {bubbles.map((b, i) => (
            <li key={i} className={`flex ${b.me ? "justify-end" : "justify-start"}`}>
              <div
                className={`relative max-w-[85%] rounded-2xl px-3 py-2 shadow-xs ${
                  b.me
                    ? "rounded-tr-xs bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]"
                    : "rounded-tl-xs bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]"
                }`}
              >
                <WaText text={b.text} sources={b.sources} />

                {/* Bloc sources citées */}
                {b.sources && b.sources.length > 0 && (
                  <div className="mt-2 border-t border-black/10 pt-1.5 dark:border-white/10">
                    <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                      {t("Sources Baobab Dev (+5 XP accordés) :")}
                    </p>
                    <div className="mt-1 space-y-1">
                      {b.sources.map((source, idx) => (
                        <Link
                          key={source.answer_id}
                          href={`/questions/${source.question_id}`}
                          className="block text-[11px] text-emerald-700 underline dark:text-emerald-400"
                        >
                          [{idx + 1}] @{source.author_username}
                          {source.author_city ? ` (${source.author_city})` : ""}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Heure et coches */}
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781] dark:text-[#8696a0]">
                  <span>{b.time}</span>
                  {b.me && (
                    <span className="text-[#53bdeb]" title={t("Message lu")}>
                      ✓✓
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}

          {/* Bulle de frappe en cours */}
          {typing && (
            <li className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-xs bg-white px-3 py-2 shadow-xs dark:bg-[#202c33]">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600" />
              </div>
            </li>
          )}
          <div ref={endRef} />
        </ol>

        {/* Input barre inférieure */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 border-t border-black/5 bg-[#f0f2f5] p-2 dark:border-white/5 dark:bg-[#202c33]"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("Message…")}
            className="flex-1 rounded-full bg-white px-4 py-2 text-sm text-[#111b21] outline-none shadow-xs placeholder:text-zinc-400 dark:bg-[#2a3942] dark:text-[#e9edef]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || typing}
            aria-label={t("Envoyer")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>

        {/* Barre home indicator iOS */}
        <div className="flex justify-center bg-[#f0f2f5] pb-2 dark:bg-[#202c33]">
          <div className="h-1 w-28 rounded-full bg-zinc-400 dark:bg-zinc-600" />
        </div>
      </div>
    </div>
  );
}
