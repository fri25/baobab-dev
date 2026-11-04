"use client";

import { useState } from "react";
import type { GriotResult } from "@/lib/griot";

type Bubble = { me: boolean; text: string; time: string };

const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// Rendu au format WhatsApp : *gras*, ```code```
function WaText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(```[\s\S]*?```|\*[^*\n]+\*)/g).map((part, i) =>
        part.startsWith("```") ? (
          <code key={i} className="my-1 block whitespace-pre-wrap rounded bg-black/5 p-1.5 font-mono text-[11px]">
            {part.slice(3, -3).replace(/^\w*\n/, "")}
          </code>
        ) : part.startsWith("*") && part.endsWith("*") ? (
          <strong key={i}>{part.slice(1, -1)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
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
    const res = await fetch("/api/griot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, channel: "whatsapp" }),
    });
    const json = (await res.json()) as GriotResult & { error?: string };
    let text = json.error ?? json.answer.replace(/\*\*([^*]+)\*\*/g, "*$1*");
    if (!json.error && json.sources.length) {
      text += `\n\n*Sources*\n${json.sources
        .map((s, i) => `[${i + 1}] ${s.author_username}${s.author_city ? ` (${s.author_city})` : ""} · +5 XP`)
        .join("\n")}`;
    }
    setBubbles((b) => [...b, { me: false, text, time: now() }]);
    setTyping(false);
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
              <WaText text={b.text} />
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
