"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";

const prefix = (userId: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${userId}/`;

// N'accepte qu'une photo déposée par l'utilisateur dans son propre dossier ; l'ancienne est supprimée
export async function setAvatar(url: string) {
  const { supabase, user, profile } = await requireSession("/parametres");
  if (!url.startsWith(prefix(user.id)) || url.includes("..")) return { error: "Photo invalide." };
  const { error } = await supabase.from("profiles").update({ avatar_url: url, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return { error: error.message };
  await removeStored(supabase, user.id, profile.avatar_url, url);
  revalidatePath("/", "layout");
  return { error: null };
}

// Retour à la photo GitHub (si le compte est lié), sinon aucune photo : l'initiale s'affiche
export async function removeAvatar() {
  const { supabase, user, profile } = await requireSession("/parametres");
  const github = (user.user_metadata?.avatar_url as string | undefined) ?? null;
  const { error } = await supabase.from("profiles").update({ avatar_url: github, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return { error: error.message, url: profile.avatar_url as string | null };
  await removeStored(supabase, user.id, profile.avatar_url, null);
  revalidatePath("/", "layout");
  return { error: null, url: github };
}

async function removeStored(
  supabase: Awaited<ReturnType<typeof requireSession>>["supabase"],
  userId: string,
  previous: string | null,
  keep: string | null,
) {
  if (previous && previous !== keep && previous.startsWith(prefix(userId))) {
    await supabase.storage.from("avatars").remove([previous.slice(prefix(userId).length - userId.length - 1)]);
  }
}
