import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = { id: string; username: string; full_name: string | null; role: string; xp: number; avatar_url: string | null };

export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, xp, avatar_url")
    .eq("id", data.user.id)
    .single<CurrentProfile>();
  return { supabase, user: data.user, profile };
}

export async function requireSession(next = "/") {
  const session = await getSession();
  if (!session.user || !session.profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session as { supabase: typeof session.supabase; user: NonNullable<typeof session.user>; profile: CurrentProfile };
}
