import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Détecteur de projets abandonnés (§7.3) : dernier commit, intérêt passé, issues restées sans réponse.

const gh = async (path: string) => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok ? res.json() : null;
};

export type RepoCheck = { checked: boolean; detected?: boolean; last_commit?: string; stars?: number; forks?: number; unanswered?: number };

export async function checkProjectRepo(projectId: string, repoUrl: string): Promise<RepoCheck> {
  const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) return { checked: false };
  const repo = `${match[1]}/${match[2].replace(/\.git$/, "")}`;

  const meta = (await gh(`/repos/${repo}`)) as { pushed_at: string; stargazers_count: number; forks_count: number } | null;
  if (!meta) return { checked: false };
  const issues = ((await gh(`/repos/${repo}/issues?state=open&per_page=50`)) ?? []) as {
    comments: number;
    created_at: string;
    pull_request?: unknown;
  }[];
  // Issue sans réponse : ouverte depuis plus de 30 jours, aucun commentaire (les Pull Requests sont exclues)
  const unanswered = issues.filter(
    (i) => !i.pull_request && i.comments === 0 && Date.now() - new Date(i.created_at).getTime() > 30 * 86400000,
  ).length;

  const { data: detected } = await createAdminClient().rpc("set_project_repo_stats", {
    p_project: projectId,
    p_last_commit: meta.pushed_at,
    p_stars: meta.stargazers_count,
    p_forks: meta.forks_count,
    p_unanswered: unanswered,
  });
  return { checked: true, detected: Boolean(detected), last_commit: meta.pushed_at, stars: meta.stargazers_count, forks: meta.forks_count, unanswered };
}

// Tâche quotidienne : 20 projets par passage (limite de l'API GitHub publique : 60 requêtes / heure)
export async function checkStaleProjects() {
  const admin = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: projects } = await admin
    .from("projects")
    .select("id, repo_url")
    .like("repo_url", "https://github.com/%")
    .or(`repo_checked_at.is.null,repo_checked_at.lt.${weekAgo}`)
    .or("abandon_status.is.null,abandon_status.in.(detected,revival)")
    .order("repo_checked_at", { ascending: true, nullsFirst: true })
    .limit(20);
  const results = await Promise.all((projects ?? []).map((p) => checkProjectRepo(p.id, p.repo_url!)));
  return { checked: results.filter((r) => r.checked).length, detected: results.filter((r) => r.detected).length };
}
