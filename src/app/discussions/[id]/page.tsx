import { dateLocale } from "@/lib/i18n/current";
import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { joinTopic, leaveTopic } from "../actions";
import type { Relation } from "../RelationsPicker";
import { InviteRelations, ShareTopic } from "./TopicTools";
import { ChatRoom, type ChatMessage, type Person } from "./ChatRoom";

const PAGE = 50;

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invites?: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const { invites } = await searchParams;
  const { supabase, user } = await getSession();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, kind, title, description, tags, created_by, scheduled_at")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound(); // conversation privée d'autres devs : invisible (RLS)

  const [{ data: rows }, { data: members }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, author_id, body, reply_to, created_at, edited_at, deleted_at")
      .eq("conversation_id", id)
      .order("id", { ascending: false })
      .limit(PAGE + 1),
    supabase
      .from("conversation_members")
      .select("user_id, role, profile:profiles!conversation_members_user_id_fkey(username, full_name, avatar_url, city)")
      .eq("conversation_id", id),
  ]);

  const hasMore = (rows?.length ?? 0) > PAGE;
  const messages = (rows ?? []).slice(0, PAGE).reverse() as ChatMessage[];
  const memberList = (members ?? []) as unknown as { user_id: string; role: string; profile: Person }[];

  // Profils des auteurs (membres + auteurs ayant quitté le sujet)
  const people: Record<string, Person> = {};
  for (const m of memberList) people[m.user_id] = m.profile;
  const missing = [...new Set(messages.map((m) => m.author_id))].filter((a) => !people[a]);
  if (missing.length) {
    const { data } = await supabase.from("profiles").select("id, username, full_name, avatar_url, city").in("id", missing);
    for (const p of data ?? []) people[p.id] = p;
  }

  const isMember = Boolean(user && memberList.some((m) => m.user_id === user.id));
  const { data: relations } = conversation.kind === "topic" && isMember ? await supabase.rpc("my_relations") : { data: [] };
  const opensAt = conversation.scheduled_at && new Date(conversation.scheduled_at) > new Date() ? new Date(conversation.scheduled_at) : null;
  const opensLabel = opensAt?.toLocaleString(dateLocale(), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });
  const other = conversation.kind === "direct" ? memberList.find((m) => m.user_id !== user?.id) : undefined;

  return (
    <main className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
      <div className="min-w-0 flex-1">
        <Link href={conversation.kind === "direct" ? "/discussions" : "/discussions?onglet=sujets"} className="text-sm text-muted hover:text-primary">
          {t("← Discussions")}
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          {other ? (
            <Link href={`/u/${other.profile.username}`} className="flex items-center gap-3">
              <Avatar user={other.profile} size={40} />
              <span>
                <span className="block text-xl font-bold">{other.profile.full_name ?? other.profile.username}</span>
                <span className="text-sm text-muted">
                  @{other.profile.username}
                  {other.profile.city && ` · ${other.profile.city}`}
                </span>
              </span>
            </Link>
          ) : (
            <div>
              <h1 className="text-xl font-bold"># {conversation.title}</h1>
              {conversation.description && <p className="text-sm text-muted">{conversation.description}</p>}
            </div>
          )}
          {conversation.kind === "topic" && user && (
            <form action={(isMember ? leaveTopic : joinTopic).bind(null, id)}>
              <button className={`rounded-full px-4 py-1.5 text-sm ${isMember ? "border border-border text-muted" : "bg-primary font-medium text-primary-ink"}`}>
                {isMember ? t("Quitter le sujet") : t("Rejoindre")}
              </button>
            </form>
          )}
        </div>

        {invites && <p className="mt-3 rounded-lg bg-leaf/10 p-3 text-sm text-leaf">{invites}{" "}{t("relation(s) invitée(s) : elles ont reçu une notification.")}</p>}
        {opensAt && (
          <p className="mt-3 rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm">
            <strong>{t("Sujet programmé")}</strong>{" "}{t(": les messages s'ouvrent le")}{" "}{opensLabel}{" "}{t("(heure de Cotonou). Les membres seront prévenus.")}{" "}{user?.id === conversation.created_by ? t("En tant que créateur·rice, tu peux déjà poster un message d'accueil.") : ""}
          </p>
        )}

        {conversation.kind === "topic" && (
          <details className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm lg:hidden">
            <summary className="cursor-pointer font-medium">{t("Partager")}{isMember ? t(" ou inviter des relations") : t(" le sujet")}</summary>
            <div className="mt-3 space-y-4">
              <ShareTopic title={conversation.title ?? t("Sujet")} />
              {isMember && <InviteRelations conversationId={id} relations={(relations ?? []) as Relation[]} members={memberList.map((m) => m.user_id)} />}
            </div>
          </details>
        )}

        <ChatRoom
          conversationId={id}
          kind={conversation.kind}
          meId={user?.id ?? null}
          isMember={isMember}
          initialMessages={messages}
          initialPeople={people}
          hasMore={hasMore}
        />
      </div>

      {conversation.kind === "topic" && (
        <aside className="hidden w-64 shrink-0 space-y-6 lg:block">
          <section className="mt-8">
            <h2 className="text-sm font-semibold">{t("Partager le sujet")}</h2>
            <div className="mt-2">
              <ShareTopic title={conversation.title ?? t("Sujet")} />
            </div>
          </section>
          {isMember && (
            <section>
              <h2 className="text-sm font-semibold">{t("Inviter des relations")}</h2>
              <div className="mt-2">
                <InviteRelations conversationId={id} relations={(relations ?? []) as Relation[]} members={memberList.map((m) => m.user_id)} />
              </div>
            </section>
          )}
          <section>
          <h2 className="text-sm font-semibold">{memberList.length}{" "}{t("membre(s)")}</h2>
          <ul className="mt-3 space-y-2">
            {memberList.map((m) => (
              <li key={m.user_id}>
                <Link href={`/u/${m.profile.username}`} className="flex items-center gap-2 text-sm hover:text-primary">
                  <Avatar user={m.profile} size={24} />
                  <span className="truncate">{m.profile.full_name ?? m.profile.username}</span>
                  {m.role === "owner" && <span className="text-xs text-muted">{t("créateur")}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {conversation.tags.length > 0 && <p className="mt-4 text-xs text-muted">{conversation.tags.join(" · ")}</p>}
          </section>
        </aside>
      )}
    </main>
  );
}
