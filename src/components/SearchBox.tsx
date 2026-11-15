"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

// Recherche globale (questions) : Ctrl+K ou ⌘K donne le focus au champ
export function SearchBox() {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action="/questions" role="search" className="relative w-full max-w-md">
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
      </svg>
      <input
        ref={ref}
        type="search"
        name="q"
        placeholder={t("Rechercher une question, un code, une Squad…")}
        aria-label={t("Rechercher")}
        className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-14 text-sm placeholder:text-muted focus:border-primary/60 focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 font-mono text-[10px] text-muted sm:block">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </form>
  );
}
