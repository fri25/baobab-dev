import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { joinDebugSession } from "../actions";
import { DebugRoom } from "./DebugRoom";

export default async function DebugSessionPage({ params }: { params: Promise<{ code: string }> }) {
  const t = await getT();
  const { code } = await params;
  const { supabase, user, profile } = await requireSession(`/debug/${code}`);

  const { data: session } = await supabase
    .from("debug_sessions")
    .select("id, title, host_id, status, host:profiles!debug_sessions_host_id_fkey(username, full_name)")
    .eq("share_code", code)
    .maybeSingle();
  if (!session) notFound();

  const isHost = session.host_id === user.id;
  if (!isHost) await joinDebugSession(session.id);

  const [{ data: me }, { data: participants }, { data: events }] = await Promise.all([
    supabase.from("debug_participants").select("can_write").eq("session_id", session.id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("debug_participants")
      .select("user_id, profile:profiles!debug_participants_user_id_fkey(username, full_name)")
      .eq("session_id", session.id),
    // Hôte : restauration après rechargement. Session terminée : relecture.
    isHost || session.status === "ended"
      ? supabase.from("debug_events").select("kind, payload").eq("session_id", session.id).order("id")
      : Promise.resolve({ data: [] }),
  ]);

  const host = session.host as unknown as { username: string; full_name: string | null };
  const names: Record<string, string> = { [session.host_id]: host.full_name ?? host.username };
  for (const p of (participants ?? []) as unknown as { user_id: string; profile: { username: string; full_name: string | null } }[]) {
    names[p.user_id] = p.profile.full_name ?? p.profile.username;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/debug" className="text-sm text-muted hover:text-primary">
        {t("← Pair-Debugging")}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{session.title}</h1>
      <p className="mb-4 text-sm text-muted">
        {t("Hôte :")}{" "}{names[session.host_id]}{" "}{t("· code")}{" "}<span className="font-mono">{code}</span>
      </p>
      <DebugRoom
        sessionId={session.id}
        code={code}
        title={session.title ?? ""}
        me={{ id: user.id, name: profile.username }}
        isHost={isHost}
        initialCanWrite={me?.can_write ?? false}
        names={names}
        ended={session.status === "ended"}
        replay={(events ?? []) as never}
      />
    </main>
  );
}
