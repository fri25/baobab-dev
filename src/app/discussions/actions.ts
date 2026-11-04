"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { parseTags } from "@/lib/format";

const path = (id: string) => `/discussions/${id}`;

export async function startDirect(otherId: string) {
  const { supabase } = await requireSession("/discussions");
  const { data, error } = await supabase.rpc("get_or_create_direct", { p_other: otherId });
  if (error) redirect(`/discussions?error=${encodeURIComponent(error.message)}`);
  redirect(path(data as string));
}

export async function createTopic(formData: FormData) {
  const { supabase } = await requireSession("/discussions/new");
  const { data, error } = await supabase.rpc("create_topic", {
    p_title: String(formData.get("title")),
    p_description: String(formData.get("description") || ""),
    p_tags: parseTags(formData.get("tags")),
  });
  if (error) redirect(`/discussions/new?error=${encodeURIComponent(error.message)}`);
  redirect(path(data as string));
}

export async function joinTopic(id: string) {
  const { supabase } = await requireSession(path(id));
  await supabase.rpc("join_topic", { p_conversation: id });
  revalidatePath(path(id));
}

export async function leaveTopic(id: string) {
  const { supabase } = await requireSession(path(id));
  await supabase.rpc("leave_topic", { p_conversation: id });
  revalidatePath(path(id));
}

export async function sendMessage(conversationId: string, body: string, replyTo: number | null) {
  const { supabase, user } = await requireSession(path(conversationId));
  const text = body.trim().slice(0, 4000);
  if (!text) return { error: null };
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, author_id: user.id, body: text, reply_to: replyTo });
  return { error: error?.message ?? null };
}

export async function markRead(conversationId: string) {
  const { supabase } = await requireSession(path(conversationId));
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
}

export async function deleteMessage(messageId: number) {
  const { supabase } = await requireSession("/discussions");
  const { error } = await supabase.rpc("delete_message", { p_message_id: messageId });
  return { error: error?.message ?? null };
}

export async function reportMessage(messageId: number, reason: string) {
  const { supabase, user } = await requireSession("/discussions");
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: user.id, target_type: "message", target_id: String(messageId), reason });
  return { error: error?.message ?? null };
}

export async function toggleBlock(userId: string, username: string) {
  const { supabase, user } = await requireSession(`/u/${username}`);
  const { data: existing } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", userId)
    .maybeSingle();
  if (existing) await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
  else await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: userId });
  revalidatePath(`/u/${username}`);
}
