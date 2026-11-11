"use client";

import { useState } from "react";
import Link from "next/link";
import type { GriotResult } from "@/lib/griot";

type Bubble = { me: boolean; text: string; time: string; sources?: GriotResult["sources"] };

const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// Rendu au format WhatsApp : *gras*, ```code```
function WaText({ text, sources = [] }: { text: string; sources?: GriotResult["sources"] }) {
  return (
    <>
      {text.split(/(```[\s\S]*?```|\*[^*\n]+\*|\[\d+\])/g).map((part, i) => {
        const citation = /^\[(\d+)\]$/.exec(part);
        const source = citation ? sources[Number(citation[1]) - 1] : undefined;
        if (source) {
          return (
            <Link key={i} href={`/questions/${source.question_id}`} className="text-primary underline">
              {part}
            </Link>
          );
        }
        if (part.startsWith("```")) {
          return (
            <code key={i} className="my-1 block whitespace-pre-wrap rounded bg-black/5 p-1.5 font-mono text-[11px]">
              {part.slice(3, -3).replace(/^\w*\n/, "")}
            </code>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) return <strong key={i}>{part.slice(1, -1)}</strong>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Simulation fidèle de la conversation WhatsApp (même moteur que le webhook /api/whatsapp)
export function WhatsAppDemo() {
  const [bubbles, setBubbles] = useState<Bubble[]>([
    { me: false, text: "Bonjour, je suis le Griot de Baobab Dev 🌳 Pose-moi ta question de code.", time: now() },
  ]);
  const [draft, setDraft] = useState("Comment intégrer FedaPay dans Laravel ?");
  const [typing, setTyping] = useState(false);

  async function send() {
    const q = draft.trim();
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
    <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[2rem] border-8 border-[#1f1a14] bg-[#efeae2] shadow-xl">
      <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2f6b3a] text-lg">🌳</span>
        <div>
          <p className="font-semibold leading-tight">Griot · Baobab Dev</p>
          <p className="text-xs opacity-80">{typing ? "en train d'écrire…" : "en ligne"}</p>
        </div>
      </div>
      <ol className="h-[480px] space-y-2 overflow-y-auto p-3 text-[13px] text-[#111b21]">
        {bubbles.map((b, i) => (
          <li key={i} className={`flex ${b.me ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-lg px-2.5 py-1.5 shadow-sm ${b.me ? "bg-[#d9fdd3]" : "bg-white"}`}>
              <WaText text={b.text} sources={b.sources} />
              {b.sources && b.sources.length > 0 && (
                <div className="mt-1 border-t border-black/10 pt-1">
                  <strong>Sources</strong>
                  {b.sources.map((source, i) => (
                    <Link key={source.answer_id} href={`/questions/${source.question_id}`} className="block text-primary underline">
                      [{i + 1}] {source.author_username}
                      {source.author_city ? ` (${source.author_city})` : ""} · +5 XP
                    </Link>
                  ))}
                </div>
              )}
              <span className="mt-0.5 block text-right text-[10px] text-[#667781]">{b.time}</span>
            </div>
          </li>
        ))}
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 bg-[#f0f2f5] p-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message"
          className="flex-1 rounded-full bg-white px-4 py-2 text-sm text-[#111b21] outline-none"
        />
        <button aria-label="Envoyer" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884] text-white">
          ➤
        </button>
      </form>
    </div>
  );
}
