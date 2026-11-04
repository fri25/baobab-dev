"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export async function createDebugSession(formData: FormData) {
  const { supabase, user } = await requireSession("/debug");
  const { data, error } = await supabase
    .from("debug_sessions")
    .insert({
      host_id: user.id,
      title: String(formData.get("title") || "Session de débogage"),
      bounty_id: String(formData.get("bounty_id") || "") || null,
    })
    .select("share_code")
    .single();
  if (error) redirect(`/debug?error=${encodeURIComponent(error.message)}`);
  redirect(`/debug/${data.share_code}`);
}

export async function joinDebugSession(sessionId: string) {
  const { supabase, user } = await requireSession("/debug");
  await supabase.from("debug_participants").upsert({ session_id: sessionId, user_id: user.id }, { ignoreDuplicates: true });
}

export async function grantControl(sessionId: string, userId: string, canWrite: boolean) {
  const { supabase } = await requireSession("/debug");
  await supabase.from("debug_participants").update({ can_write: canWrite }).eq("session_id", sessionId).eq("user_id", userId);
}

export async function saveDebugEvents(
  sessionId: string,
  events: { kind: "diff" | "cursor" | "terminal" | "chat" | "control"; payload: unknown }[],
  bytes: number,
) {
  const { supabase, user } = await requireSession("/debug");
  if (events.length === 0) return;
  await supabase.from("debug_events").insert(events.map((e) => ({ session_id: sessionId, user_id: user.id, ...e })));
  await supabase.rpc("add_debug_bytes", { p_session_id: sessionId, p_bytes: bytes });
}

export async function endDebugSession(sessionId: string, code: string) {
  const { supabase } = await requireSession("/debug");
  await supabase.from("debug_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
  revalidatePath(`/debug/${code}`);
}
