"use client";

import { useT } from "@/lib/i18n/client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";

export type Relation = { id: string; username: string; full_name: string | null; avatar_url: string | null; city: string | null; via: string | null };

// Choix de relations (messages privés, Squads) : recherche + cases à cocher, envoyées sous le nom « invite »
export function RelationsPicker({
  relations,
  exclude = [],
  selected,
  onChange,
}: {
  relations: Relation[];
  exclude?: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useT();
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const list = relations
    .filter((r) => !exclude.includes(r.id))
    .filter((r) => !f || r.username.includes(f) || (r.full_name ?? "").toLowerCase().includes(f));

  if (!relations.length) {
    return (
      <p className="text-xs text-muted">
        {t("Tu n'as pas encore de relations : elles apparaissent quand tu échanges en privé avec un dev ou rejoins une Squad.")}
      </p>
    );
  }

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t("Rechercher une relation…")}
        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      />
      <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
        {list.map((r) => {
          const checked = selected.includes(r.id);
          return (
            <li key={r.id}>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${checked ? "bg-primary/10" : "hover:bg-background"}`}>
                <input
                  type="checkbox"
                  name="invite"
                  value={r.id}
                  checked={checked}
                  onChange={() => onChange(checked ? selected.filter((id) => id !== r.id) : [...selected, r.id])}
                />
                <Avatar user={r} size={24} />
                <span className="min-w-0 flex-1 truncate">
                  {r.full_name ?? r.username} <span className="text-muted">@{r.username}</span>
                </span>
                {r.via && <span className="shrink-0 text-xs text-muted">{r.via}</span>}
              </label>
            </li>
          );
        })}
        {!list.length && <li className="px-2 py-1.5 text-xs text-muted">{t("Aucune relation à inviter.")}</li>}
      </ul>
      {selected.length > 0 && <p className="mt-1 text-xs text-leaf">{selected.length}{" "}{t("relation(s) sélectionnée(s)")}</p>}
    </div>
  );
}
