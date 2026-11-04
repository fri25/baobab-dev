import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { type Activity, activityByDay } from "@/lib/github-activity";

const ICON: Record<Activity["kind"], string> = {
  push: "●",
  pr: "⇄",
  issue: "!",
  release: "◆",
  create: "+",
  star: "★",
};

export function ActivityList({ activities, showLogin = false, canConvert = false }: { activities: Activity[]; showLogin?: boolean; canConvert?: boolean }) {
  if (!activities.length) return <p className="text-sm text-muted">Aucune activité publique récente.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {activities.map((a) => (
        <li key={a.id} className="flex gap-3 px-4 py-2.5 text-sm">
          <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-primary" aria-hidden="true">
            {ICON[a.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <a href={a.url} className="line-clamp-2 hover:text-primary">
              {a.title}
            </a>
            <p className="truncate text-xs text-muted">
              {showLogin && `@${a.login} · `}
              {a.repo} · {timeAgo(a.at)}
            </p>
            {canConvert && a.issueUrl && (
              <Link
                href={`/bourse/new?issue=${encodeURIComponent(a.issueUrl)}&titre=${encodeURIComponent(a.title.replace("Issue ouverte : ", ""))}`}
                className="text-xs text-gold hover:underline"
              >
                Transformer en ticket de la Micro-Bourse →
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ActivityHeatmap({ activities }: { activities: Activity[] }) {
  const days = activityByDay(activities);
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="flex gap-0.5" role="img" aria-label="Activité GitHub des 30 derniers jours">
      {days.map((d) => (
        <span
          key={d.day}
          title={`${d.day} : ${d.count} événement(s)`}
          className="h-4 flex-1 rounded-sm"
          style={{ background: d.count ? "var(--leaf)" : "var(--border)", opacity: d.count ? 0.35 + (0.65 * d.count) / max : 1 }}
        />
      ))}
    </div>
  );
}
