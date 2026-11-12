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

function portoNovoSchedule(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const parts = [year, month, day, hour, minute].map(Number);
  const [y, m, d, h, min] = parts;
  if (y < 1970 || m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) return null;
  const localTime = Date.UTC(y, m - 1, d, h, min);
  const check = new Date(localTime);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;

  return new Date(localTime - 60 * 60 * 1000);
}

export async function inviteToTopic(conversationId: string, formData: FormData) {
  const { supabase } = await requireSession(path(conversationId));
  const username = String(formData.get("username") ?? "").trim().replace(/^@/, "");
  const scheduled = formData.get("when") === "scheduled";
  const scheduledAt = scheduled ? portoNovoSchedule(formData.get("scheduled_at")) : null;
  if (scheduled && (!scheduledAt || scheduledAt <= new Date())) {
    redirect(`${path(conversationId)}?error=${encodeURIComponent("Choisis une date et une heure futures en Africa/Porto-Novo.")}#inviter`);
  }

  const { error } = await supabase.rpc("invite_to_topic", {
    p_conversation: conversationId,
    p_username: username,
    p_scheduled_at: scheduledAt?.toISOString() ?? null,
  });
  if (error) redirect(`${path(conversationId)}?error=${encodeURIComponent(error.message)}#inviter`);
  revalidatePath(path(conversationId));
  revalidatePath("/notifications");
  redirect(`${path(conversationId)}?invite=${scheduled ? "scheduled" : "sent"}#inviter`);
}

export async function cancelTopicInvite(invitationId: string, conversationId: string) {
  const { supabase } = await requireSession(path(conversationId));
  const { error } = await supabase.rpc("cancel_topic_invitation", { p_invitation: invitationId });
  if (error) redirect(`${path(conversationId)}?error=${encodeURIComponent(error.message)}#inviter`);
  revalidatePath(path(conversationId));
  redirect(`${path(conversationId)}?invite=cancelled#inviter`);
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
