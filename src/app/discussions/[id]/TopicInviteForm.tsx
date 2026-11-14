"use client";

import { useState } from "react";
import { inviteToTopic } from "../actions";

export function TopicInviteForm({
  conversationId,
  minDateTime,
}: {
  conversationId: string;
  minDateTime: string;
}) {
  const [when, setWhen] = useState<"now" | "scheduled">("now");

  return (
    <form action={inviteToTopic.bind(null, conversationId)} className="mt-3 space-y-3 rounded-xl border border-border bg-background p-3">
      <label className="block text-sm font-medium">
        Pseudo Baobab Dev
        <input
          name="username"
          required
          minLength={2}
          maxLength={30}
          pattern="[a-zA-Z0-9_]+"
          placeholder="ex. aicha_dev"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
        />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Quand envoyer l’invitation ?</legend>
        <div className="mt-1 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="when" value="now" checked={when === "now"} onChange={() => setWhen("now")} />
            Maintenant
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="when"
              value="scheduled"
              checked={when === "scheduled"}
              onChange={() => setWhen("scheduled")}
            />
            Programmer
          </label>
        </div>
      </fieldset>
      {when === "scheduled" && (
        <label className="block text-sm font-medium">
          Date et heure (Africa/Porto-Novo)
          <input
            type="datetime-local"
            name="scheduled_at"
            required
            min={minDateTime}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2"
          />
          <span className="mt-1 block text-xs font-normal text-muted">L’invitation sera envoyée dans les 5 minutes suivant l’heure choisie.</span>
        </label>
      )}
      <button className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
        Envoyer l’invitation
      </button>
    </form>
  );
}
