"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Radar en direct : toute validation, clôture ou modification d'opportunité rafraîchit la liste.
// Avec des échéances imminentes, la page se rafraîchit aussi chaque minute.
export function RadarLive({ imminent }: { imminent: number }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setUpdatedAt(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
  }, [imminent]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
        setUpdatedAt(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      }, 500);
    };
    const channel = supabase
      .channel("radar")
      .on("postgres_changes", { event: "*", schema: "public", table: "opportunities" }, refresh)
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    const poll = imminent > 0 ? setInterval(refresh, 60_000) : null;
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      supabase.removeChannel(channel);
      if (poll) clearInterval(poll);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [router, imminent]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${connected ? "animate-pulse bg-leaf" : "bg-border"}`} />
      {connected ? "En direct" : "Hors ligne"}
      {updatedAt && ` · mis à jour à ${updatedAt}`}
    </span>
  );
}
