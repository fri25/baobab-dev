"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toToast, type Notification } from "@/lib/notifications";
import { requireSession } from "@/lib/auth";

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireSession("/notifications");
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) redirect(`/notifications?error=${encodeURIComponent("Les notifications n’ont pas pu être marquées comme lues.")}`);
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}

export async function openNotification(notificationId: number) {
  if (!Number.isSafeInteger(notificationId) || notificationId < 1) redirect("/notifications");
  const { supabase, user } = await requireSession("/notifications");
  const { data: notification, error: fetchError } = await supabase
    .from("notifications")
    .select("id, kind, payload, read_at")
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchError) redirect(`/notifications?error=${encodeURIComponent("Cette notification n’a pas pu être ouverte.")}`);
  if (!notification) redirect("/notifications");

  if (!notification.read_at) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) redirect(`/notifications?error=${encodeURIComponent("Cette notification n’a pas pu être marquée comme lue.")}`);
  }

  const toast = toToast(notification as Notification);
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  redirect(toast?.href ?? "/notifications");
}
