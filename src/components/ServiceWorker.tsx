"use client";

import { useT } from "@/lib/i18n/client";
import { useEffect, useState } from "react";

export function ServiceWorker() {
  const t = useT();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else if ("serviceWorker" in navigator) {
      // En développement, un worker installé par un build de prod resservirait d'anciens CSS/JS : on le retire
      navigator.serviceWorker.getRegistrations().then(async (regs) => {
        if (!regs.length) return;
        await Promise.all(regs.map((r) => r.unregister()));
        if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
        window.location.reload();
      }).catch(() => {});
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="sticky top-0 z-30 bg-gold px-4 py-1.5 text-center text-xs font-medium text-background">
      {t("Hors connexion : tu lis les pages déjà consultées. Tes brouillons sont gardés sur ce téléphone.")}
    </div>
  );
}
