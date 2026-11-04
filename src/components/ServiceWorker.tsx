"use client";

import { useEffect, useState } from "react";

export function ServiceWorker() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
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
      Hors connexion : tu lis les pages déjà consultées. Tes brouillons sont gardés sur ce téléphone.
    </div>
  );
}
