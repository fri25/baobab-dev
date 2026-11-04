"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { endDebugSession, grantControl, saveDebugEvents } from "../actions";

// Protocole texte compact : chaque message fait quelques dizaines d'octets.
type Op =
  | { t: "d"; s: number; r: number; x: string } // diff : à la position s, remplacer r caractères par x
  | { t: "S"; x: string; term: string[] } // instantané complet (reprise après coupure)
  | { t: "hi" } // demande d'instantané
  | { t: "c"; p: number } // curseur
  | { t: "tm"; l: string } // ligne de terminal
  | { t: "m"; b: string } // message
  | { t: "ask" } // demande de prise en main
  | { t: "grant"; u: string; w: boolean }; // l'hôte accorde ou retire la main

type Envelope = Op & { from: string };

const SECRET_PATTERNS = [
  /^(\s*[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASS|PWD)[A-Z0-9_]*\s*[=:]\s*)(.+)$/gim,
  /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}\b/g,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

// Les secrets ne quittent jamais la machine de l'hôte. Le masque garde la même longueur
// pour que les positions des diffs restent identiques chez l'hôte et chez les invités.
function maskSecrets(text: string) {
  return SECRET_PATTERNS.reduce(
    (acc, re, i) =>
      acc.replace(re, i === 0 ? (_m, k: string, v: string) => k + "•".repeat(v.length) : (m) => "•".repeat(m.length)),
    text,
  );
}

function diff(prev: string, next: string) {
  let s = 0;
  while (s < prev.length && s < next.length && prev[s] === next[s]) s++;
  let e = 0;
  while (e < prev.length - s && e < next.length - s && prev[prev.length - 1 - e] === next[next.length - 1 - e]) e++;
  return { s, r: prev.length - s - e, x: next.slice(s, next.length - e) };
}

// Reconstruit l'état à partir du journal (rechargement de l'hôte, relecture)
function fold(ops: Envelope[]) {
  let text = "";
  let term: string[] = [];
  for (const op of ops) {
    if (op.t === "S") ({ x: text, term } = op);
    else if (op.t === "d") text = text.slice(0, op.s) + op.x + text.slice(op.s + op.r);
    else if (op.t === "tm") term = [...term, op.l].slice(-200);
  }
  return { text, term };
}

const STARTER = `// Colle ici le fichier à déboguer (les secrets sont masqués à l'envoi)
Route::post('/webhooks/fedapay', [PaymentController::class, 'webhook']);

// .env
FEDAPAY_SECRET_KEY=sk_live_abcdef123456789
`;

type Props = {
  sessionId: string;
  code: string;
  title: string;
  me: { id: string; name: string };
  isHost: boolean;
  initialCanWrite: boolean;
  names: Record<string, string>;
  ended: boolean;
  replay: { kind: string; payload: { ops?: Envelope[] } }[];
};

export function DebugRoom(props: Props) {
  const { sessionId, code, me, isHost } = props;
  const [history] = useState(() => props.replay.flatMap((e) => e.payload.ops ?? []));
  const [restored] = useState(() => (history.length ? fold(history) : null));
  const initialText = isHost && !props.ended ? (restored?.text ?? STARTER) : "";
  const [text, setText] = useState(initialText);
  const [terminal, setTerminal] = useState<string[]>(isHost ? (restored?.term ?? []) : []);
  const [chat, setChat] = useState<{ from: string; b: string }[]>([]);
  const [cursors, setCursors] = useState<Record<string, number>>({});
  const [canWrite, setCanWrite] = useState(isHost || props.initialCanWrite);
  const [requests, setRequests] = useState<string[]>([]);
  const [names, setNames] = useState(props.names);
  const [online, setOnline] = useState(false);
  const [rate, setRate] = useState(0);
  const [total, setTotal] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const sharedRef = useRef(maskSecrets(initialText)); // texte tel que vu par les invités
  const termRef = useRef<string[]>(isHost ? (restored?.term ?? []) : []);
  const bytesWindow = useRef<{ at: number; n: number }[]>([]);
  const pending = useRef<Envelope[]>([]);
  const pendingBytes = useRef(0);

  const count = useCallback((n: number) => {
    bytesWindow.current.push({ at: Date.now(), n });
    setTotal((t) => t + n);
  }, []);

  const send = useCallback(
    (op: Op, persist = true) => {
      const envelope = { ...op, from: me.id } as Envelope;
      const n = new TextEncoder().encode(JSON.stringify(envelope)).length;
      count(n);
      channelRef.current?.send({ type: "broadcast", event: "op", payload: envelope });
      if (persist && op.t !== "c" && op.t !== "hi") {
        pending.current.push(envelope);
        pendingBytes.current += n;
      }
    },
    [me.id, count],
  );

  // Application des opérations reçues
  const apply = useCallback(
    (op: Envelope) => {
      switch (op.t) {
        case "d":
          setText((cur) => {
            const next = cur.slice(0, op.s) + op.x + cur.slice(op.s + op.r);
            sharedRef.current = isHost ? maskSecrets(next) : next;
            return next;
          });
          break;
        case "S":
          if (!isHost) {
            sharedRef.current = op.x;
            setText(op.x);
            termRef.current = op.term;
            setTerminal(op.term);
          }
          break;
        case "hi":
          if (isHost) send({ t: "S", x: sharedRef.current, term: termRef.current.slice(-50) }, false);
          break;
        case "c":
          setCursors((c) => ({ ...c, [op.from]: op.p }));
          break;
        case "tm":
          termRef.current = [...termRef.current, op.l].slice(-200);
          setTerminal(termRef.current);
          break;
        case "m":
          setChat((c) => [...c, { from: op.from, b: op.b }]);
          break;
        case "ask":
          if (isHost) setRequests((r) => (r.includes(op.from) ? r : [...r, op.from]));
          break;
        case "grant":
          if (op.u === me.id) setCanWrite(op.w);
          break;
      }
    },
    [isHost, me.id, send],
  );

  // Connexion au canal temps réel, avec reprise automatique après coupure
  useEffect(() => {
    if (props.ended) return;
    const supabase = createClient();
    const channel = supabase.channel(`debug:${code}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
    channel
      .on("broadcast", { event: "op" }, ({ payload }) => {
        count(new TextEncoder().encode(JSON.stringify(payload)).length);
        apply(payload as Envelope);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ name: string }>();
        setNames((n) => {
          const next = { ...n };
          for (const [id, metas] of Object.entries(state)) next[id] = metas[0]?.name ?? next[id];
          return next;
        });
      })
      .subscribe(async (status) => {
        setOnline(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          await channel.track({ name: me.name });
          if (!isHost) send({ t: "hi" }, false); // demande l'état courant (reprise)
        }
      });
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, me.id, me.name, isHost, props.ended, apply, send, count]);

  // Instantané initial pour la relecture
  useEffect(() => {
    if (isHost && !props.ended && !restored) {
      pending.current.push({ t: "S", x: sharedRef.current, term: [], from: me.id });
    }
  }, [isHost, props.ended, restored, me.id]);

  // Débit glissant sur 5 s + sauvegarde des événements pour la relecture
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      bytesWindow.current = bytesWindow.current.filter((b) => now - b.at < 5000);
      setRate(bytesWindow.current.reduce((a, b) => a + b.n, 0) / 5 / 1024);
      if (pending.current.length) {
        const ops = pending.current;
        const bytes = pendingBytes.current;
        pending.current = [];
        pendingBytes.current = 0;
        saveDebugEvents(sessionId, [{ kind: "diff", payload: { ops } }], bytes);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionId]);

  function onEdit(value: string) {
    setText(value);
    const masked = isHost ? maskSecrets(value) : value;
    const d = diff(sharedRef.current, masked);
    sharedRef.current = masked;
    if (d.r || d.x) send({ t: "d", ...d });
  }

  const lastCursor = useRef(0);
  function onCursor(pos: number) {
    if (Date.now() - lastCursor.current < 400) return; // limite les curseurs à 2,5/s
    lastCursor.current = Date.now();
    send({ t: "c", p: pos });
  }

  // Relecture d'une session terminée
  async function playReplay() {
    setText("");
    setTerminal([]);
    setChat([]);
    termRef.current = [];
    sharedRef.current = "";
    for (const op of history) {
      if (op.t === "S") {
        sharedRef.current = op.x;
        setText(op.x);
        termRef.current = op.term;
        setTerminal(op.term);
        continue;
      }
      if (op.t === "d") {
        sharedRef.current = sharedRef.current.slice(0, op.s) + op.x + sharedRef.current.slice(op.s + op.r);
        setText(sharedRef.current);
      } else apply(op);
      await new Promise((r) => setTimeout(r, op.t === "d" ? 40 : 300));
    }
  }

  const replayBytes = props.replay.reduce((a, e) => a + JSON.stringify(e.payload).length, 0);
  const lineOf = (pos: number) => text.slice(0, pos).split("\n").length;
  const rateOk = rate < 5;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-leaf" : props.ended ? "bg-muted" : "animate-pulse bg-gold"}`} />
          <span>{props.ended ? "Session terminée" : online ? "Connecté" : "Reconnexion…"}</span>
          <span className="text-muted">· {Object.keys(names).length} participant(s)</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className={rateOk ? "text-leaf" : "text-primary"}>{rate.toFixed(2)} Ko/s</span>
          <span className="text-muted">{(total / 1024).toFixed(1)} Ko au total</span>
        </div>
      </div>

      {props.ended ? (
        <button onClick={playReplay} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">
          ▶ Rejouer la session ({(replayBytes / 1024).toFixed(1)} Ko)
        </button>
      ) : (
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="rounded-full border border-border px-4 py-1.5"
          >
            Copier le lien de partage
          </button>
          {!isHost && !canWrite && (
            <button onClick={() => send({ t: "ask" })} className="rounded-full border border-primary px-4 py-1.5 text-primary">
              Demander la main
            </button>
          )}
          {!isHost && canWrite && <span className="rounded-full bg-leaf/10 px-4 py-1.5 text-leaf">Tu as la main</span>}
          {isHost && (
            <button onClick={() => endDebugSession(sessionId, code)} className="rounded-full border border-border px-4 py-1.5 text-muted">
              Terminer la session
            </button>
          )}
        </div>
      )}

      {isHost && requests.length > 0 && (
        <div className="rounded-xl border border-gold bg-gold/10 p-3 text-sm">
          {requests.map((u) => (
            <div key={u} className="flex items-center justify-between gap-2">
              <span>{names[u] ?? "Un invité"} demande à prendre la main.</span>
              <span className="flex gap-2">
                <button
                  onClick={async () => {
                    await grantControl(sessionId, u, true);
                    send({ t: "grant", u, w: true });
                    setRequests((r) => r.filter((x) => x !== u));
                  }}
                  className="rounded bg-leaf px-3 py-1 text-xs text-background"
                >
                  Accepter
                </button>
                <button onClick={() => setRequests((r) => r.filter((x) => x !== u))} className="rounded border border-border px-3 py-1 text-xs">
                  Refuser
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-1 flex flex-wrap gap-3 text-xs text-muted">
            {Object.entries(cursors)
              .filter(([id]) => id !== me.id)
              .map(([id, pos]) => (
                <span key={id}>
                  <span className="text-primary">▍</span> {names[id] ?? "invité"} · ligne {lineOf(pos)}
                </span>
              ))}
          </div>
          <textarea
            value={text}
            readOnly={!canWrite || props.ended}
            onChange={(e) => onEdit(e.target.value)}
            onSelect={(e) => onCursor(e.currentTarget.selectionStart)}
            spellCheck={false}
            className="h-96 w-full rounded-xl border border-border bg-[#1f1a14] p-4 font-mono text-sm text-[#f3ece2] outline-none"
          />
          {isHost && <p className="mt-1 text-xs text-muted">Les invités voient une version où les secrets sont remplacés par des •••.</p>}
        </div>

        <div className="space-y-4">
          <section>
            <h2 className="mb-1 text-sm font-semibold">Terminal</h2>
            <pre className="h-40 overflow-y-auto rounded-xl bg-black p-3 font-mono text-xs text-green-300">
              {terminal.join("\n") || "$ "}
            </pre>
            {isHost && !props.ended && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem("line") as HTMLInputElement;
                  for (const l of maskSecrets(input.value).split("\n")) {
                    termRef.current = [...termRef.current, l].slice(-200);
                    send({ t: "tm", l });
                  }
                  setTerminal(termRef.current);
                  input.value = "";
                }}
                className="mt-1"
              >
                <input name="line" placeholder="Colle la sortie du terminal" className="w-full rounded-lg border border-border bg-surface px-2 py-1 font-mono text-xs" />
              </form>
            )}
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold">Discussion</h2>
            <ol className="h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-3 text-sm">
              {chat.map((m, i) => (
                <li key={i}>
                  <span className="font-medium">{m.from === me.id ? "Moi" : (names[m.from] ?? "invité")}</span> : {m.b}
                </li>
              ))}
            </ol>
            {!props.ended && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem("msg") as HTMLInputElement;
                  if (!input.value.trim()) return;
                  send({ t: "m", b: input.value });
                  setChat((c) => [...c, { from: me.id, b: input.value }]);
                  input.value = "";
                }}
                className="mt-1"
              >
                <input name="msg" placeholder="Message" className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm" />
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
