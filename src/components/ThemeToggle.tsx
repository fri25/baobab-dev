"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { ThemePreference } from "@/lib/theme";

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  system: "dark",
  dark: "light",
  light: "system",
};

const THEME_LABEL: Record<ThemePreference, string> = {
  system: "Système",
  light: "Clair",
  dark: "Sombre",
};

export function ThemeToggle({
  initialPreference = "system",
  compact = false,
}: {
  initialPreference?: ThemePreference;
  compact?: boolean;
}) {
  const t = useT();
  const label = (p: ThemePreference) => t(THEME_LABEL[p]);
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);

  useEffect(() => {
    // Synchroniser avec l'attribut actuel si défini
    const docTheme = document.documentElement.dataset.theme as ThemePreference | undefined;
    if (docTheme === "dark" || docTheme === "light") {
      setPreference(docTheme);
    } else {
      setPreference("system");
    }
  }, []);

  function cycleTheme() {
    const next = NEXT_THEME[preference];
    try {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie =
        next === "system"
          ? "theme=; Max-Age=0; Path=/; SameSite=Lax"
          : `theme=${next}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
      setPreference(next);
      if (next === "system") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.dataset.theme = next;
      }
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={t("Thème actuel : {theme}. Cliquer pour alterner (sombre, clair, système).", { theme: label(preference) })}
      title={t("Thème : {theme} (cliquer pour changer)", { theme: label(preference) })}
      className={`relative inline-flex items-center justify-center rounded-xl border border-border/80 bg-surface/80 text-muted transition hover:border-primary/50 hover:bg-surface hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        compact ? "h-9 w-9" : "h-9 px-3 gap-2 text-xs font-medium"
      }`}
    >
      {preference === "dark" && (
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-amber-400" fill="currentColor" aria-hidden="true">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
      {preference === "light" && (
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-amber-600" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {preference === "system" && (
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-primary" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm2 0v8h10V5H5z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {!compact && <span>{label(preference)}</span>}
    </button>
  );
}
