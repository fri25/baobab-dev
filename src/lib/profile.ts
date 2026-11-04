import { createClient } from "@/lib/supabase/server";

export type Badge = {
  code: string;
  name: string;
  category: string;
  tier: "bronze" | "argent" | "or";
  description: string;
};

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
  availability: "available" | "limited" | "busy" | null;
  goals: string[];
  xp: number;
  pinned_badges: string[];
  created_at: string;
  skills: { name: string; weight: number; source: string }[];
  badges: Badge[];
  activity: { amount: number; reason: string; created_at: string }[];
  projects: { name: string; slug: string; description: string; stack: string[] }[];
};

export async function getProfile(username: string): Promise<ProfileView | null> {
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
  if (!p) return null;

  const [skills, badges, activity, projects] = await Promise.all([
    supabase.from("user_skills").select("weight, source, skills(name)").eq("user_id", p.id).order("weight", { ascending: false }),
    supabase.from("user_badges").select("awarded_at, badges(*)").eq("user_id", p.id).order("awarded_at", { ascending: false }),
    supabase.from("points_log").select("amount, reason, created_at").eq("user_id", p.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("projects").select("name, slug, description, stack").eq("owner_id", p.id).order("created_at", { ascending: false }),
  ]);

  return {
    ...p,
    skills: (skills.data ?? []).map((s) => ({
      name: (s.skills as unknown as { name: string }).name,
      weight: s.weight,
      source: s.source,
    })),
    badges: (badges.data ?? []).map((b) => b.badges as unknown as Badge),
    activity: activity.data ?? [],
    projects: projects.data ?? [],
  };
}
