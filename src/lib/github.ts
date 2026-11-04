import type { SupabaseClient } from "@supabase/supabase-js";

type Repo = { language: string | null; topics?: string[]; fork: boolean };

// Technologies reconnues dans les topics GitHub, en plus du langage principal
const TOPIC_SKILLS: Record<string, string> = {
  laravel: "Laravel",
  django: "Django",
  flutter: "Flutter",
  react: "React",
  nextjs: "Next.js",
  vue: "Vue",
  nodejs: "Node.js",
  docker: "Docker",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  "mobile-money": "Mobile Money",
  ussd: "USSD",
  fedapay: "FedaPay",
  kkiapay: "Kkiapay",
  cinetpay: "CinetPay",
};

// Pré-remplit le profil (§5.1) : bio, ville et technologies depuis les dépôts publics
export async function importGithubProfile(supabase: SupabaseClient, userId: string, login: string) {
  const gh = (path: string) =>
    fetch(`https://api.github.com${path}`, { headers: { Accept: "application/vnd.github+json" } }).then((r) =>
      r.ok ? r.json() : null,
    );

  const [user, repos] = (await Promise.all([gh(`/users/${login}`), gh(`/users/${login}/repos?per_page=100&sort=pushed`)])) as [
    { bio: string | null; location: string | null } | null,
    Repo[] | null,
  ];

  if (user) {
    await supabase
      .from("profiles")
      .update({ bio: user.bio, city: user.location, updated_at: new Date().toISOString() })
      .eq("id", userId);
  }

  const counts = new Map<string, number>();
  for (const repo of (repos ?? []).filter((r) => !r.fork)) {
    const names = [repo.language, ...(repo.topics ?? []).map((t) => TOPIC_SKILLS[t])].filter(Boolean) as string[];
    for (const name of new Set(names)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return;

  await supabase.from("skills").upsert(
    [...counts.keys()].map((name) => ({ name })),
    { onConflict: "name", ignoreDuplicates: true },
  );
  const { data: skills } = await supabase.from("skills").select("id, name").in("name", [...counts.keys()]);
  await supabase.from("user_skills").upsert(
    (skills ?? []).map((s) => ({ user_id: userId, skill_id: s.id, source: "github", weight: counts.get(s.name) })),
  );
}
