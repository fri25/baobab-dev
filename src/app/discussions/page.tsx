import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Discussions · Baobab Dev" };

type Conversation = {
  id: string;
  kind: "direct" | "topic";
  title: string | null;
  last_message_at: string;
  unread: number;
  last_body: string | null;
  last_author: string | null;
  other_id: string | null;
  other_username: string | null;
  other_full_name: string | null;
  other_avatar_url: string | null;
  other_city: string | null;
};

export default async function DiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string; error?: string }>;
}) {
  const { onglet, error } = await searchParams;
  const { supabase, user } = await getSession();
  const tab = onglet === "sujets" || !user ? "sujets" : "prives";

  const [{ data: mine }, { data: topics }] = await Promise.all([
    user ? supabase.rpc("my_conversations") : Promise.resolve({ data: [] }),
    supabase
      .from("conversations")
      .select("id, title, description, tags, last_message_at, messages_count, conversation_members(count)")
      .eq("kind", "topic")
      .order("last_message_at", { ascending: false })
      .limit(50),
  ]);
  const conversations = (mine ?? []) as Conversation[];
  const direct = conversations.filter((c) => c.kind === "direct");
  const unreadByTopic = new Map(conversations.filter((c) => c.kind === "topic").map((c) => [c.id, c.unread]));
  const directUnread = direct.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0);
  const topicUnread = [...unreadByTopic.values()].filter((n) => n > 0).length;

  const tabClass = (active: boolean) =>
    `flex items-center gap-2 rounded-full px-4 py-1.5 ${active ? "bg-foreground text-background" : "border border-border"}`;
  const badge = (n: number) =>
    n > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-primary-ink">{n}</span>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Discussions</h1>
          <p className="text-muted">Écris à un dev en privé ou rejoins un sujet pour discuter avec la communauté.</p>
        </div>
        <Link href="/discussions/new" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
          Lancer un sujet
        </Link>
      </div>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <nav className="mt-6 flex gap-2 text-sm">
        {user && (
          <Link href="/discussions" className={tabClass(tab === "prives")}>
            Messages privés {badge(directUnread)}
          </Link>
        )}
        <Link href="/discussions?onglet=sujets" className={tabClass(tab === "sujets")}>
          Sujets {badge(topicUnread)}
        </Link>
      </nav>

      {tab === "prives" ? (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
          {direct.map((c) => (
            <li key={c.id}>
              <Link href={`/discussions/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                <Avatar user={{ username: c.other_username ?? "?", full_name: c.other_full_name, avatar_url: c.other_avatar_url }} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={c.unread ? "font-semibold" : "font-medium"}>{c.other_full_name ?? c.other_username}</span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <p className={`truncate text-sm ${c.unread ? "text-foreground" : "text-muted"}`}>
                    {c.last_body ? `${c.last_author === c.other_username ? "" : "Toi : "}${c.last_body}` : "Nouvelle conversation"}
                  </p>
                </div>
                {badge(c.unread)}
              </Link>
            </li>
          ))}
          {!direct.length && (
            <li className="px-4 py-6 text-center text-sm text-muted">
              Aucun message. Pour écrire à un dev, ouvre son profil et clique sur « Envoyer un message ».
            </li>
          )}
        </ul>
      ) : (
        <ul className="mt-6 space-y-3">
          {topics?.map((t) => {
            const members = (t.conversation_members as unknown as { count: number }[])[0]?.count ?? 0;
            const unread = unreadByTopic.get(t.id) ?? 0;
            const joined = unreadByTopic.has(t.id);
            return (
              <li key={t.id}>
                <Link href={`/discussions/${t.id}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-primary">
                  <div className="flex items-start justify-between gap-2">
                    <span className={unread ? "font-semibold" : "font-medium"}># {t.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {joined && <span className="text-xs text-leaf">membre</span>}
                      {badge(unread)}
                    </span>
                  </div>
                  {t.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</p>}
                  <p className="mt-2 text-xs text-muted">
                    {members} membre{members > 1 ? "s" : ""} · {t.messages_count} message{t.messages_count > 1 ? "s" : ""} ·
                    actif {timeAgo(t.last_message_at)}
                    {t.tags.length > 0 && ` · ${t.tags.join(", ")}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
