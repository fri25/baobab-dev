"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendSquadMessage } from "../actions";

type Message = { id: number; author_id: string; body: string; created_at: string };

export function SquadChat({
  squadId,
  initial,
  members,
}: {
  squadId: string;
  initial: Message[];
  members: Record<string, string>;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  // Discussion en temps réel (Supabase Realtime)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`squad-${squadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "squad_messages", filter: `squad_id=eq.${squadId}` },
        (payload) => setMessages((m) => (m.some((x) => x.id === payload.new.id) ? m : [...m, payload.new as Message])),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [squadId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  return (
    <div className="flex h-96 flex-col rounded-xl border border-border bg-surface">
      <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-4 text-sm">
        {messages.length === 0 && <li className="text-muted">Lancez la discussion.</li>}
        {messages.map((m) => (
          <li key={m.id}>
            <span className="font-medium">{members[m.author_id] ?? "?"}</span>{" "}
            <span className="text-xs text-muted">
              {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <p className="whitespace-pre-line">{m.body}</p>
          </li>
        ))}
      </ol>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = draft;
          setDraft("");
          await sendSquadMessage(squadId, body);
        }}
        className="flex gap-2 border-t border-border p-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message à la Squad…"
          className="flex-1 rounded-lg bg-background px-3 py-2 text-sm outline-none"
        />
        <button className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-ink">Envoyer</button>
      </form>
    </div>
  );
}
