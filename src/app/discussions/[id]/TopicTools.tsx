"use client";

import { useEffect, useState } from "react";
import { inviteToTopic } from "../actions";
import { type Relation, RelationsPicker } from "../RelationsPicker";

// Partage du sujet par lien (copie, WhatsApp, partage natif du téléphone)
export function ShareTopic({ title }: { title: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setUrl(window.location.origin + window.location.pathname);
    setCanShare("share" in navigator);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie ce lien :", url);
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-1">
        <input readOnly value={url} aria-label="Lien du sujet" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 font-mono text-xs" />
        <button type="button" onClick={copy} className="shrink-0 rounded-lg bg-foreground px-3 text-xs text-background">
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <div className="flex gap-2 text-xs">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Rejoins la discussion « ${title} » sur Baobab Dev : ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-border px-3 py-1 text-leaf hover:border-leaf"
        >
          WhatsApp
        </a>
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ title, url }).catch(() => {})}
            className="rounded-full border border-border px-3 py-1 hover:border-primary"
          >
            Partager…
          </button>
        )}
      </div>
    </div>
  );
}

export function InviteRelations({ conversationId, relations, members }: { conversationId: string; relations: Relation[]; members: string[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const { invited, error } = await inviteToTopic(conversationId, selected);
    setBusy(false);
    setStatus(error ?? (invited ? `${invited} relation(s) invitée(s) et prévenue(s).` : "Ces relations sont déjà membres."));
    if (!error) setSelected([]);
  }

  return (
    <div className="space-y-2">
      <RelationsPicker relations={relations} exclude={members} selected={selected} onChange={setSelected} />
      {selected.length > 0 && (
        <button type="button" disabled={busy} onClick={send} className="w-full rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-ink disabled:opacity-50">
          {busy ? "Envoi…" : `Inviter ${selected.length} relation(s)`}
        </button>
      )}
      {status && <p className="text-xs text-leaf">{status}</p>}
    </div>
  );
}
