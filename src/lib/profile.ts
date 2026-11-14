import { createClient } from "@/lib/supabase/server";

export type Badge = {
  code: string;
  name: string;
  category: string;
  tier: "bronze" | "argent" | "or";
  description: string;
};

type XpBreakdownRow = { reason: string; total: number | string };

export type ProfileView = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  github_username: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  languages: string[];
  programming_languages: string[];
  availability: "available" | "limited" | "busy" | null;
  goals: string[];
  xp: number;
  pinned_badges: string[];
  created_at: string;
  skills: { name: string; weight: number; source: string }[];
  xpBreakdown: { reason: string; amount: number }[];
  badges: Badge[];
  activity: { amount: number; reason: string; created_at: string }[];
  projects: { name: string; slug: string; description: string; stack: string[] }[];
};

export async function getProfile(username: string): Promise<ProfileView | null> {
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
  if (!p) return null;

  const [skills, badges, activity, projects, xpBreakdown] = await Promise.all([
    supabase.from("user_skills").select("weight, source, skills(name)").eq("user_id", p.id).order("weight", { ascending: false }),
    supabase.from("user_badges").select("awarded_at, badges(*)").eq("user_id", p.id).order("awarded_at", { ascending: false }),
    supabase.from("points_log").select("amount, reason, created_at").eq("user_id", p.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("projects").select("name, slug, description, stack").eq("owner_id", p.id).order("created_at", { ascending: false }),
    supabase.rpc("profile_xp_breakdown", { p_user: p.id }),
  ]);
  if (xpBreakdown.error) {
    throw new Error("Impossible de charger le détail des XP du profil.", { cause: xpBreakdown.error });
  }
  const xpEntries = xpBreakdown.data as XpBreakdownRow[] | null;

  return {
    ...p,
    skills: (skills.data ?? []).map((s) => ({
      name: (s.skills as unknown as { name: string }).name,
      weight: s.weight,
      source: s.source,
    })),
    xpBreakdown: (xpEntries ?? []).map((entry) => ({
      reason: entry.reason,
      amount: Number(entry.total),
    })),
    badges: (badges.data ?? []).map((b) => b.badges as unknown as Badge),
    activity: activity.data ?? [],
    projects: projects.data ?? [],
  };
}
