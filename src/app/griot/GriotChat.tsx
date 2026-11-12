"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { GriotResult } from "@/lib/griot";

type Turn = { question: string; result?: GriotResult; error?: string };

const EXAMPLES = [
  "Comment intégrer FedaPay dans Laravel et vérifier les webhooks ?",
  "Mes paiements Kkiapay restent en pending, pourquoi ?",
  "Comment gérer les sessions d'un menu USSD en Node.js ?",
];

export function GriotChat({ initialQuestion }: { initialQuestion?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setQuestion("");
    setTurns((t) => [...t, { question: q }]);
    const res = await fetch("/api/griot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const json = await res.json();
    setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? (res.ok ? { ...turn, result: json } : { ...turn, error: json.error }) : turn)));
    setLoading(false);
  }

  // Question posée depuis la bulle flottante : envoyée une seule fois
  const asked = useRef(false);
  useEffect(() => {
    if (initialQuestion && !asked.current) {
      asked.current = true;
      ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  return (
    <div>
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
            {!turn.result && !turn.error && <p className="animate-pulse text-sm text-muted">Le Griot consulte la communauté…</p>}
            {turn.result && (
              <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-border bg-surface p-4">
                <Markdown text={turn.result.answer} />
                {turn.result.sources.length > 0 ? (
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
                ) : (
                  <Link
                    href="/questions/new"
                    className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink"
                  >
                    Publier ma question
                  </Link>
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
