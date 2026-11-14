import { levelForXp } from "@/lib/levels";

export function XpProgress({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const level = levelForXp(xp);
  const progress = Math.round(level.progress * 100);
  const remaining = level.next ? Math.max(0, level.next.floor - xp) : 0;

  return (
    <div className={compact ? "w-full max-w-56" : "w-full"}>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{level.name}</span>
        <span className="font-mono text-muted">
          {xp.toLocaleString("fr-FR")} XP{level.next ? ` · ${remaining} avant ${level.next.name}` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progression vers le niveau ${level.next?.name ?? "maximum"}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={level.next ? `${progress} %, ${remaining} XP avant ${level.next.name}` : "Niveau maximum atteint"}
        className="h-2 overflow-hidden rounded-full bg-border/70"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-leaf to-tech transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
