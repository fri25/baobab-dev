import type { Badge } from "@/lib/profile";

const TIER_CONFIG = {
  bronze: {
    label: "Bronze",
    color: "var(--bronze)",
    bg: "rgba(180, 83, 9, 0.08)",
    border: "rgba(180, 83, 9, 0.35)",
    glow: "rgba(180, 83, 9, 0.2)",
  },
  argent: {
    label: "Argent",
    color: "var(--silver)",
    bg: "rgba(148, 163, 184, 0.1)",
    border: "rgba(148, 163, 184, 0.4)",
    glow: "rgba(148, 163, 184, 0.2)",
  },
  or: {
    label: "Or",
    color: "var(--gold)",
    bg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.45)",
    glow: "rgba(245, 158, 11, 0.25)",
  },
};

export function BadgeChip({ badge, large = false }: { badge: Badge; large?: boolean }) {
  const config = TIER_CONFIG[badge.tier] ?? TIER_CONFIG.bronze;

  return (
    <div
      className={`group relative flex items-center gap-3.5 rounded-2xl border transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        large ? "p-4" : "p-3"
      }`}
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
        boxShadow: `0 2px 10px -2px ${config.glow}`,
      }}
      title={badge.description}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl p-1.5 shadow-xs`}
        style={{ backgroundColor: "var(--surface)", border: `1px solid ${config.border}` }}
      >
        <svg
          viewBox="0 0 24 24"
          className={large ? "h-9 w-9 shrink-0" : "h-7 w-7 shrink-0"}
          aria-hidden="true"
        >
          <circle cx="12" cy="9.5" r="6.5" fill={config.color} />
          <path d="M7.5 14.5L5.5 21L12 18L18.5 21L16.5 14.5" fill={config.color} opacity="0.8" />
          <path
            d="M12 5.5L13.3 8.3L16.3 8.7L14.1 10.8L14.7 13.8L12 12.3L9.3 13.8L9.9 10.8L7.7 8.7L10.7 8.3L12 5.5Z"
            fill="var(--surface)"
          />
        </svg>
      </div>

      <div className="min-w-0">
        <p className="truncate font-bold text-foreground text-sm leading-tight">{badge.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          <span className="font-semibold uppercase tracking-wider text-[10px]" style={{ color: config.color }}>
            {config.label}
          </span>{" "}
          · {badge.description}
        </p>
      </div>
    </div>
  );
}
