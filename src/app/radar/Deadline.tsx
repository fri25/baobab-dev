"use client";

import { dateLocale } from "@/lib/i18n/current";
import { useT } from "@/lib/i18n/client";
import { useEffect, useState } from "react";

// Fin de journée de la date limite, heure de Cotonou (UTC+1)
const endOf = (date: string) => new Date(`${date}T23:59:59+01:00`).getTime();

function label(ms: number) {
  if (ms <= 0) return { text: "Date limite dépassée", tone: "muted" as const };
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (h < 24) {
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return { text: `Clôture dans ${h} h ${String(m).padStart(2, "0")} min`, tone: "urgent" as const };
  }
  if (d < 7) return { text: `Clôture dans ${d} jour${d > 1 ? "s" : ""}`, tone: "soon" as const };
  return { text: `Clôture dans ${d} jours`, tone: "normal" as const };
}

const TONE = {
  urgent: "bg-primary text-primary-ink animate-pulse",
  soon: "bg-gold/15 text-gold",
  normal: "bg-background text-muted",
  muted: "bg-background text-muted line-through",
};

// Compte à rebours en direct (rafraîchi chaque minute, et chaque seconde pendant la dernière heure)
export function Deadline({ date, compact = false }: { date: string; compact?: boolean }) {
  const t = useT();
  const [now, setNow] = useState<number | null>(null);
  const ms = now === null ? null : endOf(date) - now;

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms !== null && ms < 3_600_000 ? 1000 : 60_000);
    return () => clearInterval(id);
  }, [ms !== null && ms < 3_600_000]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatted = new Date(`${date}T12:00:00+01:00`).toLocaleDateString(dateLocale(), { day: "numeric", month: "long" });
  if (ms === null) return <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">{t("avant le")}{" "}{formatted}</span>;
  const { text, tone } = label(ms);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]}`} title={`Date limite : ${formatted}`}>
      ⏱ {text}
      {!compact && tone !== "muted" && <span className="font-normal opacity-80">· {formatted}</span>}
    </span>
  );
}
