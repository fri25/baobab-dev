import type { Badge } from "@/lib/profile";

const TIER_COLOR = { bronze: "var(--bronze)", argent: "var(--silver)", or: "var(--gold)" };
const TIER_LABEL = { bronze: "Bronze", argent: "Argent", or: "Or" };

export function BadgeChip({ badge, large = false }: { badge: Badge; large?: boolean }) {
  const color = TIER_COLOR[badge.tier];
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-surface ${large ? "p-4" : "p-3"}`}
      style={{ borderColor: color }}
      title={badge.description}
    >
      <svg viewBox="0 0 24 24" className={large ? "h-10 w-10 shrink-0" : "h-8 w-8 shrink-0"} aria-hidden="true">
        <circle cx="12" cy="10" r="7" fill={color} />
        <path d="M8 15l-2 7 6-3 6 3-2-7" fill={color} opacity="0.7" />
        <path d="M12 6l1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" fill="var(--surface)" />
      </svg>
      <div className="min-w-0">
        <p className="truncate font-medium">{badge.name}</p>
        <p className="truncate text-xs text-muted">
          {TIER_LABEL[badge.tier]} · {badge.description}
        </p>
      </div>
    </div>
  );
}
