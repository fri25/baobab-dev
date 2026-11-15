"use client";

import { useT } from "@/lib/i18n/client";
import { useEffect, useState } from "react";

export type SuggestedProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

export function ProfileSuggestions({
  query,
  onSelect,
  placement = "below",
}: {
  query: string;
  onSelect: (profile: SuggestedProfile) => void;
  placement?: "above" | "below";
}) {
  const t = useT();
  const [users, setUsers] = useState<SuggestedProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = query.replace(/^@/, "").trim();
    if (!normalized) {
      setUsers([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/profiles/suggest?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Impossible de charger les suggestions.");
        const result = (await response.json()) as { users: SuggestedProfile[] };
        setUsers(result.users);
      } catch (reason) {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setUsers([]);
        setError(reason instanceof Error ? reason.message : "Impossible de charger les suggestions.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (!query) return null;

  return (
    <div className={`absolute z-20 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl ${placement === "above" ? "bottom-full mb-1" : "top-full mt-1"}`}>
      {loading && <p className="px-3 py-2 text-xs text-muted">{t("Recherche…")}</p>}
      {error && <p role="status" className="px-3 py-2 text-xs text-danger">{error}</p>}
      {!loading && !error && users.length === 0 && (
        <p role="status" className="px-3 py-2 text-xs text-muted">{t("Aucun membre trouvé.")}</p>
      )}
      {users.map((profile) => (
        <button
          key={profile.id}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(profile)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-background focus-visible:bg-background"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {(profile.full_name ?? profile.username).slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">@{profile.username}</span>
            {profile.full_name && <span className="block truncate text-xs text-muted">{profile.full_name}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
