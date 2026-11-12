"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function RadarLiveRefresh({ urgent }: { urgent: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("radar-opportunities")
      .on("postgres_changes", { event: "*", schema: "public", table: "opportunities" }, () => router.refresh())
      .subscribe();
    const timer = setInterval(() => router.refresh(), urgent ? 60_000 : 300_000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [router, urgent]);

  return <span className="sr-only" aria-live="polite">Le Radar s’actualise automatiquement.</span>;
}
