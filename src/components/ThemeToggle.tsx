"use client";

import { useState } from "react";
import type { ThemePreference } from "@/lib/theme";

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  system: "dark",
  dark: "light",
  light: "system",
};

const THEME_LABEL: Record<ThemePreference, string> = {
  system: "Automatique",
  light: "Clair",
  dark: "Sombre",
};

export function ThemeToggle({ initialPreference }: { initialPreference: ThemePreference }) {
  const [preference, setPreference] = useState(initialPreference);
  const [error, setError] = useState<string | null>(null);

  function cycleTheme() {
    const next = NEXT_THEME[preference];
    setError(null);
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
      setError("Impossible d’enregistrer le thème.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={cycleTheme}
        aria-label={`Thème ${THEME_LABEL[preference]}. Cliquer pour changer.`}
        title={`Thème : ${THEME_LABEL[preference]}`}
        className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-medium text-muted transition hover:border-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
      >
        {preference === "dark" ? "☾" : preference === "light" ? "☀" : "Auto"}
        <span className="ml-1.5 hidden sm:inline">{THEME_LABEL[preference]}</span>
      </button>
      {error && (
        <span role="status" className="absolute right-0 top-full mt-1 whitespace-nowrap rounded bg-surface px-2 py-1 text-xs text-primary shadow">
          {error}
        </span>
      )}
    </div>
  );
}
