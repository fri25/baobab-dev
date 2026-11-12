import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { cancelTopicInvite, joinTopic, leaveTopic } from "../actions";
import { ChatRoom, type ChatMessage, type Person } from "./ChatRoom";
import { ShareTopicButton } from "./ShareTopicButton";
import { TopicInviteForm } from "./TopicInviteForm";

const PAGE = 50;

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const { id } = await params;
  const { error: inviteError, invite: inviteStatus } = await searchParams;
  const { supabase, user } = await getSession();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, kind, title, description, tags, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound(); // conversation privée d'autres devs : invisible (RLS)

  const [{ data: rows }, { data: members }, { data: scheduledRows }] = await Promise.all([
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
    conversation.kind === "topic" && user
      ? supabase
          .from("topic_invitations")
          .select("id, scheduled_at, invitee:profiles!topic_invitations_invitee_id_fkey(username, full_name)")
          .eq("conversation_id", id)
          .eq("invited_by", user.id)
          .is("delivered_at", null)
          .order("scheduled_at")
      : Promise.resolve({ data: [] }),
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
  const other = conversation.kind === "direct" ? memberList.find((m) => m.user_id !== user?.id) : undefined;

  return (
    <main className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
      <div className="min-w-0 flex-1">
        <Link href={conversation.kind === "direct" ? "/discussions" : "/discussions?onglet=sujets"} className="text-sm text-muted hover:text-primary">
          ← Discussions
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
          {conversation.kind === "topic" && (
            <div className="flex flex-wrap gap-2">
              <ShareTopicButton />
              {user && (
                <form action={(isMember ? leaveTopic : joinTopic).bind(null, id)}>
                  <button className={`rounded-full px-4 py-1.5 text-sm ${isMember ? "border border-border text-muted" : "bg-primary font-medium text-primary-ink"}`}>
                    {isMember ? "Quitter le sujet" : "Rejoindre"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {conversation.kind === "topic" && user && isMember && (
          <section id="inviter" className="mt-4 rounded-2xl border border-border bg-surface p-4">
            <details open={Boolean(inviteError || inviteStatus)}>
              <summary className="cursor-pointer text-sm font-semibold">Inviter un membre ou programmer une invitation</summary>
              {inviteError && <p className="mt-3 rounded-lg bg-primary/10 p-3 text-sm text-primary">{inviteError}</p>}
              {inviteStatus === "sent" && <p className="mt-3 text-sm text-leaf">Invitation envoyée; le membre a été ajouté au sujet.</p>}
              {inviteStatus === "scheduled" && <p className="mt-3 text-sm text-leaf">Invitation programmée.</p>}
              {inviteStatus === "cancelled" && <p className="mt-3 text-sm text-leaf">Invitation programmée annulée.</p>}
              <TopicInviteForm
                conversationId={id}
                minDateTime={new Date(Date.now() + 62 * 60 * 1000).toISOString().slice(0, 16)}
              />
              {scheduledRows?.length ? (
                <div className="mt-4 border-t border-border pt-3">
                  <h2 className="text-sm font-semibold">Invitations programmées</h2>
                  <ul className="mt-2 space-y-2">
                    {(scheduledRows as unknown as {
                      id: string;
                      scheduled_at: string;
                      invitee: { username: string; full_name: string | null };
                    }[]).map((invitation) => (
                      <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          @{invitation.invitee.username} ·{" "}
                          {new Date(invitation.scheduled_at).toLocaleString("fr-FR", {
                            timeZone: "Africa/Porto-Novo",
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                        <form action={cancelTopicInvite.bind(null, invitation.id, id)}>
                          <button className="text-xs text-primary hover:underline">Annuler</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </details>
          </section>
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
        <aside className="hidden w-56 shrink-0 lg:block">
          <h2 className="mt-8 text-sm font-semibold">{memberList.length} membre(s)</h2>
          <ul className="mt-3 space-y-2">
            {memberList.map((m) => (
              <li key={m.user_id}>
                <Link href={`/u/${m.profile.username}`} className="flex items-center gap-2 text-sm hover:text-primary">
                  <Avatar user={m.profile} size={24} />
                  <span className="truncate">{m.profile.full_name ?? m.profile.username}</span>
                  {m.role === "owner" && <span className="text-xs text-muted">créateur</span>}
                </Link>
              </li>
            ))}
          </ul>
          {conversation.tags.length > 0 && <p className="mt-4 text-xs text-muted">{conversation.tags.join(" · ")}</p>}
        </aside>
      )}
    </main>
  );
}
