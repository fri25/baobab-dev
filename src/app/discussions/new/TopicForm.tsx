"use client";

import { useT } from "@/lib/i18n/client";
import { useEffect, useState } from "react";
import { createTopic } from "../actions";
import { type Relation, RelationsPicker } from "../RelationsPicker";

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

// Valeur par défaut d'un champ datetime-local : dans une heure, à la minute ronde
function inOneHour() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TopicForm({ relations }: { relations: Relation[] }) {
  const t = useT();
  const [mode, setMode] = useState<"instantane" | "programme">("instantane");
  const [local, setLocal] = useState("");
  useEffect(() => setLocal(inOneHour()), []); // fuseau du navigateur, pas du serveur
  const [invited, setInvited] = useState<string[]>([]);
  const date = new Date(local);
  const iso = local && !Number.isNaN(date.getTime()) ? date.toISOString() : "";

  return (
    <form action={createTopic} className="mt-6 space-y-5">
      <label className="block text-sm font-medium">
        {t("Sujet")}
        <input name="title" required minLength={3} maxLength={80} placeholder={t("Ex. Déployer Laravel sur un VPS à petit prix")} className={input} />
      </label>
      <label className="block text-sm font-medium">
        {t("De quoi parle-t-on ?")}
        <textarea name="description" rows={3} className={input} />
      </label>
      <label className="block text-sm font-medium">
        {t("Technologies ou thèmes (séparés par des virgules)")}
        <input name="tags" placeholder={t("Laravel, hébergement")} className={input} />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">{t("Quand ?")}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            { value: "instantane", title: "Instantané", text: "Le sujet est ouvert tout de suite." },
            { value: "programme", title: "Programmé", text: "Les messages s'ouvrent à l'heure choisie ; les invités sont prévenus." },
          ].map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-xl border p-3 text-sm ${mode === o.value ? "border-primary bg-primary/5" : "border-border bg-surface"}`}
            >
              <input
                type="radio"
                name="mode"
                value={o.value}
                checked={mode === o.value}
                onChange={() => setMode(o.value as typeof mode)}
                className="mr-2"
              />
              <strong>{o.title}</strong>
              <span className="mt-1 block text-xs text-muted">{o.text}</span>
            </label>
          ))}
        </div>
        {mode === "programme" && (
          <label className="mt-3 block text-sm font-medium">
            {t("Date et heure d'ouverture")}
            <input
              type="datetime-local"
              required
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className={input}
            />
            <input type="hidden" name="scheduled_at" value={iso} />
          </label>
        )}
      </fieldset>

      <fieldset className="rounded-xl border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-medium">{t("Inviter des relations (facultatif)")}</legend>
        <p className="mb-2 text-xs text-muted">{t("Elles deviennent membres du sujet et reçoivent une notification. Tu pourras aussi partager le lien.")}</p>
        <RelationsPicker relations={relations} selected={invited} onChange={setInvited} />
      </fieldset>

      <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">
        {mode === "programme" ? t("Programmer le sujet") : t("Créer le sujet")}
      </button>
    </form>
  );
}
