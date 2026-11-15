"use client";

import { dateLocale } from "@/lib/i18n/current";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { ProfileSuggestions, type SuggestedProfile } from "@/components/ProfileSuggestions";
import { createClient } from "@/lib/supabase/client";
import { deleteMessage, markRead, reportMessage, sendMessage } from "../actions";

export type Person = { username: string; full_name: string | null; avatar_url: string | null; city?: string | null };
export type ChatMessage = {
  id: number;
  author_id: string;
  body: string;
  reply_to: number | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

type Props = {
  conversationId: string;
  kind: "direct" | "topic";
  meId: string | null;
  isMember: boolean;
  initialMessages: ChatMessage[];
  initialPeople: Record<string, Person>;
  hasMore: boolean;
};

const time = (d: string) => new Date(d).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });
const day = (d: string) => new Date(d).toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" });

export function ChatRoom({ conversationId, kind, meId, isMember, initialMessages, initialPeople, hasMore: initialHasMore }: Props) {
  const t = useT();
  const [messages, setMessages] = useState(initialMessages);
  const [people, setPeople] = useState(initialPeople);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(0);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; end: number; query: string } | null>(null);
  const stickToBottom = useRef(true);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const lastIdRef = useRef(0);
  lastIdRef.current = messages.at(-1)?.id ?? 0;

  const scheduleRead = () => {
    if (!meId || !isMember) return;
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => markRead(conversationId), 1500);
  };

  // Lecture à l'ouverture
  useEffect(() => {
    scheduleRead();
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Temps réel : nouveaux messages, modifications, présence
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`conversation:${conversationId}`, { config: { presence: { key: meId ?? "visiteur" } } });
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async ({ new: row }) => {
          const message = row as ChatMessage;
          if (!peopleRef.current[message.author_id]) {
            const { data } = await supabase
              .from("profiles")
              .select("username, full_name, avatar_url, city")
              .eq("id", message.author_id)
              .single();
            if (data) setPeople((p) => ({ ...p, [message.author_id]: data }));
          }
          setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, message]));
          if (message.author_id !== meId && document.visibilityState === "visible") scheduleRead();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        ({ new: row }) => setMessages((list) => list.map((m) => (m.id === row.id ? (row as ChatMessage) : m))),
      )
      .on("presence", { event: "sync" }, () => setOnline(Object.keys(channel.presenceState()).filter((k) => k !== "visiteur").length))
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        if (meId) await channel.track({ at: Date.now() });
        // Rattrapage : messages arrivés entre le rendu serveur (ou une coupure) et l'abonnement effectif
        setTimeout(async () => {
          const lastId = lastIdRef.current;
          const { data } = await supabase
            .from("messages")
            .select("id, author_id, body, reply_to, created_at, edited_at, deleted_at")
            .eq("conversation_id", conversationId)
            .gt("id", lastId)
            .order("id");
          if (data?.length) {
            setMessages((list) => [...list, ...(data as ChatMessage[]).filter((m) => !list.some((x) => x.id === m.id))]);
          }
        }, 2500);
      });
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, meId]);

  // Défilement automatique si l'on est déjà en bas
  useEffect(() => {
    if (stickToBottom.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function loadOlder() {
    const supabase = createClient();
    const oldest = messages[0]?.id;
    const { data } = await supabase
      .from("messages")
      .select("id, author_id, body, reply_to, created_at, edited_at, deleted_at")
      .eq("conversation_id", conversationId)
      .lt("id", oldest)
      .order("id", { ascending: false })
      .limit(51);
    const rows = (data ?? []) as ChatMessage[];
    setHasMore(rows.length > 50);
    const older = rows.slice(0, 50).reverse();
    const unknown = [...new Set(older.map((m) => m.author_id))].filter((a) => !peopleRef.current[a]);
    if (unknown.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, username, full_name, avatar_url, city").in("id", unknown);
      setPeople((p) => ({ ...p, ...Object.fromEntries((profiles ?? []).map((x) => [x.id, x])) }));
    }
    stickToBottom.current = false;
    setMessages((list) => [...older, ...list]);
  }

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    stickToBottom.current = true;
    const { error } = await sendMessage(conversationId, draft, replyTo?.id ?? null);
    setSending(false);
    if (error) setError(error);
    else {
      setDraft("");
      setReplyTo(null);
    }
  }

  function updateMention(value: string, cursor: number) {
    if (kind !== "topic" || !meId) {
      setMention(null);
      return;
    }
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (!match) {
      setMention(null);
      return;
    }
    const query = match[1];
    setMention({ start: cursor - query.length - 1, end: cursor, query });
  }

  function insertMention(profile: SuggestedProfile) {
    if (!mention) return;
    const insertion = `@${profile.username} `;
    const next = `${draft.slice(0, mention.start)}${insertion}${draft.slice(mention.end)}`;
    const cursor = mention.start + insertion.length;
    setDraft(next);
    setMention(null);
    requestAnimationFrame(() => {
      draftRef.current?.focus();
      draftRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  const byId = new Map(messages.map((m) => [m.id, m]));
  const name = (id: string) => people[id]?.full_name ?? people[id]?.username ?? "Un dev";

  return (
    <div className="mt-4 flex h-[calc(100dvh-14rem)] min-h-[420px] flex-col rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted">
        <span>{kind === "direct" ? t("Conversation privée") : t("Sujet public : tout le monde peut lire")}</span>
        {online > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-leaf" /> {online}{" "}{t("en ligne")}
          </span>
        )}
      </div>

      <ol
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        {hasMore && (
          <li className="mb-3 text-center">
            <button onClick={loadOlder} className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-foreground">
              {t("Messages précédents")}
            </button>
          </li>
        )}
        {messages.length === 0 && <li className="py-10 text-center text-sm text-muted">{t("Aucun message. Lance la discussion !")}</li>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || day(prev.created_at) !== day(m.created_at);
          const grouped =
            prev && !newDay && prev.author_id === m.author_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60000;
          const mine = m.author_id === meId;
          const parent = m.reply_to ? byId.get(m.reply_to) : undefined;
          const author = people[m.author_id];
          return (
            <li key={m.id}>
              {newDay && (
                <p className="my-4 text-center text-xs text-muted">
                  <span className="rounded-full bg-background px-3 py-1">{day(m.created_at)}</span>
                </p>
              )}
              <div className={`group flex gap-3 rounded-lg px-2 py-0.5 hover:bg-background ${grouped ? "" : "mt-3"}`}>
                <div className="w-9 shrink-0">
                  {!grouped && author && (
                    <Link href={`/u/${author.username}`}>
                      <Avatar user={author} size={36} />
                    </Link>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <p className="text-sm">
                      <Link href={`/u/${author?.username ?? ""}`} className="font-semibold hover:text-primary">
                        {name(m.author_id)}
                      </Link>{" "}
                      <span className="text-xs text-muted">{time(m.created_at)}</span>
                    </p>
                  )}
                  {parent && (
                    <p className="mb-1 truncate border-l-2 border-border pl-2 text-xs text-muted">
                      ↪ {name(parent.author_id)} : {parent.body}
                    </p>
                  )}
                  <div className={`text-sm ${m.deleted_at ? "italic text-muted" : ""}`}>
                    {m.deleted_at ? m.body : <Markdown text={m.body} />}
                  </div>
                </div>
                {!m.deleted_at && meId && (
                  <div className="flex shrink-0 items-start gap-2 text-xs text-muted opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <button onClick={() => setReplyTo(m)} className="hover:text-foreground">
                      {t("Répondre")}
                    </button>
                    {mine ? (
                      <button
                        onClick={async () => {
                          if (confirm("Supprimer ce message ?")) {
                            const { error } = await deleteMessage(m.id);
                            if (error) setError(error);
                          }
                        }}
                        className="hover:text-primary"
                      >
                        {t("Supprimer")}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const reason = prompt("Pourquoi signaler ce message ?", "Contenu inapproprié");
                          if (reason) {
                            const { error } = await reportMessage(m.id, reason);
                            setError(error ?? "Merci, la modération va examiner ce message.");
                          }
                        }}
                        className="hover:text-primary"
                      >
                        {t("Signaler")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {meId ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-border p-3"
        >
          {replyTo && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-1.5 text-xs">
              <span className="truncate">
                {t("Réponse à")}{" "}<strong>{name(replyTo.author_id)}</strong> : {replyTo.body}
              </span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label={t("Annuler la réponse")}>
                ✕
              </button>
            </div>
          )}
          {error && <p className="mb-2 text-xs text-danger">{error}</p>}
          <div className="flex items-end gap-2">
            <div className="relative min-w-0 flex-1">
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  updateMention(e.target.value, e.target.selectionStart);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={Math.min(6, Math.max(1, draft.split("\n").length))}
                maxLength={4000}
                onClick={(e) => updateMention(e.currentTarget.value, e.currentTarget.selectionStart)}
                onKeyUp={(e) => updateMention(e.currentTarget.value, e.currentTarget.selectionStart)}
                placeholder={
                  kind === "topic"
                    ? isMember
                      ? t("Ton message… (@pseudo pour mentionner, ` pour le code)")
                      : t("Écris pour rejoindre le sujet… (@pseudo pour mentionner)")
                    : t("Ton message… (` pour le code)")
                }
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {mention && (
                <ProfileSuggestions query={mention.query} onSelect={insertMention} placement="above" />
              )}
            </div>
            <button disabled={sending || !draft.trim()} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-ink disabled:opacity-50">
              {t("Envoyer")}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">{t("Entrée pour envoyer · Maj+Entrée pour aller à la ligne")}</p>
        </form>
      ) : (
        <p className="border-t border-border p-4 text-center text-sm">
          <Link href={`/login?next=/discussions/${conversationId}`} className="text-primary">
            {t("Connecte-toi")}
          </Link>{" "}
          {t("pour participer.")}
        </p>
      )}
    </div>
  );
}
