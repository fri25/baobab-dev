import "server-only";

// GitHub vivant (§7.2) : événements publics, mis en cache 10 minutes (limite de l'API publique : 60 req/h/IP).
// En V1 complète, les webhooks GitHub/GitLab alimenteront le fil en temps réel.

export type Activity = {
  id: string;
  kind: "push" | "pr" | "issue" | "release" | "create" | "star";
  repo: string;
  title: string;
  url: string;
  at: string;
  login: string;
  issueUrl?: string;
};

type GhEvent = {
  id: string;
  type: string;
  created_at: string;
  actor: { login: string };
  repo: { name: string };
  payload: {
    action?: string;
    commits?: { message: string }[];
    size?: number;
    ref?: string;
    ref_type?: string;
    pull_request?: { title: string; html_url: string; merged?: boolean };
    issue?: { title: string; html_url: string; pull_request?: unknown };
    release?: { name: string | null; tag_name: string; html_url: string };
  };
};

function toActivity(e: GhEvent): Activity | null {
  const repoUrl = `https://github.com/${e.repo.name}`;
  const base = { id: e.id, repo: e.repo.name, at: e.created_at, login: e.actor.login };
  const p = e.payload;
  switch (e.type) {
    case "PushEvent": {
      const n = p.size ?? p.commits?.length ?? 0;
      const msg = p.commits?.at(-1)?.message.split("\n")[0];
      return { ...base, kind: "push", title: `${n} commit${n > 1 ? "s" : ""}${msg ? ` : ${msg}` : ""}`, url: `${repoUrl}/commits` };
    }
    case "PullRequestEvent":
      if (!p.pull_request) return null;
      return {
        ...base,
        kind: "pr",
        title: `${p.action === "closed" && p.pull_request.merged ? "PR fusionnée" : p.action === "opened" ? "PR ouverte" : "PR"} : ${p.pull_request.title}`,
        url: p.pull_request.html_url,
      };
    case "IssuesEvent":
      if (!p.issue || p.action !== "opened") return null;
      return { ...base, kind: "issue", title: `Issue ouverte : ${p.issue.title}`, url: p.issue.html_url, issueUrl: p.issue.html_url };
    case "ReleaseEvent":
      if (!p.release) return null;
      return { ...base, kind: "release", title: `Version ${p.release.name || p.release.tag_name}`, url: p.release.html_url };
    case "CreateEvent":
      if (p.ref_type !== "repository") return null;
      return { ...base, kind: "create", title: "Nouveau dépôt", url: repoUrl };
    case "WatchEvent":
      return { ...base, kind: "star", title: "A ajouté une étoile", url: repoUrl };
    default:
      return null;
  }
}

export async function githubActivity(login: string, limit = 10): Promise<Activity[]> {
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=30`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const events = (await res.json()) as GhEvent[];
    return events.map(toActivity).filter((a): a is Activity => a !== null).slice(0, limit);
  } catch {
    return [];
  }
}

// Carte d'activité : nombre d'événements par jour sur les 30 derniers jours (limite de l'API publique)
export function activityByDay(activities: Activity[], days = 30) {
  const counts = new Map<string, number>();
  for (const a of activities) counts.set(a.at.slice(0, 10), (counts.get(a.at.slice(0, 10)) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    return { day, count: counts.get(day) ?? 0 };
  });
}
