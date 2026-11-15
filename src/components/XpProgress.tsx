"use client";

import { dateLocale } from "@/lib/i18n/current";
import { useT } from "@/lib/i18n/client";
import { useEffect, useState } from "react";
import { levelForXp } from "@/lib/levels";
import { createClient } from "@/lib/supabase/client";

export function XpProgress({
  xp: initialXp,
  compact = false,
  profileId,
}: {
  xp: number;
  compact?: boolean;
  profileId?: string;
}) {
  const t = useT();
  const [xp, setXp] = useState(initialXp);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    if (!profileId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`profile-xp:${profileId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profileId}` },
        (payload) => {
          const nextXp = Number(payload.new.xp);
          if (Number.isFinite(nextXp) && nextXp >= 0) setXp(nextXp);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setSyncError(true);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileId]);

  const level = levelForXp(xp);
  const progress = Math.round(level.progress * 100);
  const remaining = level.next ? Math.max(0, level.next.floor - xp) : 0;
  const earnedThisLevel = xp - level.floor;
  const totalThisLevel = level.next ? level.next.floor - level.floor : 0;

  return (
    <section className={compact ? "w-full max-w-56" : "mt-8 rounded-2xl border border-border bg-surface p-5"}>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">
          {!compact && `Niveau ${level.level} · `}
          {level.name}
        </span>
        <span className="font-mono text-muted">
          {xp.toLocaleString(dateLocale())}{" "}{t("XP")}{level.next ? ` · ${remaining} avant ${level.next.name}` : ""}
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
          className="h-full rounded-full bg-leaf transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
      {!compact && (
        <p className="mt-2 text-sm text-muted">
          {level.next
            ? `${earnedThisLevel.toLocaleString(dateLocale())} / ${totalThisLevel.toLocaleString(dateLocale())} XP · encore ${remaining.toLocaleString(dateLocale())} XP pour devenir ${level.next.name}`
            : t("Niveau maximal atteint")}
          {level.level < 5 && t(" · le clone IA se débloque au niveau Expert")}
        </p>
      )}
      {syncError && profileId && (
        <p role="status" className="mt-2 text-xs text-muted">
          {t("La progression ne peut pas être actualisée en direct pour le moment.")}
        </p>
      )}
    </section>
  );
}
