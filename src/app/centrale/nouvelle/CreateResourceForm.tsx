"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createResource } from "../actions";

type Option = { id: string; name: string };

export function CreateResourceForm({
  offerCode,
  offerName,
  defaultName,
  projects,
  squads,
  projectId,
  squadId,
}: {
  offerCode: string;
  offerName: string;
  defaultName: string;
  projects: Option[];
  squads: Option[];
  projectId?: string;
  squadId?: string;
}) {
  const [state, action, pending] = useActionState(createResource, null);
  const [copied, setCopied] = useState(false);

  if (state && "resourceId" in state) {
    return (
      <div className="rounded-2xl border border-leaf bg-surface p-5">
        <p className="font-semibold text-leaf">{offerName} est prêt.</p>
        {state.apiKey && (
          <div className="mt-3">
            <p className="text-sm">
              Ta clé d&apos;API : <strong>copie-la maintenant</strong>, elle ne sera plus jamais affichée (seule son empreinte est conservée).
            </p>
            <div className="mt-2 flex gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-[#1f1a14] p-3 font-mono text-xs text-[#f3ece2]">{state.apiKey}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(state.apiKey!);
                  setCopied(true);
                }}
                className="shrink-0 rounded-lg border border-border px-3 text-sm"
              >
                {copied ? "Copiée" : "Copier"}
              </button>
            </div>
          </div>
        )}
        <Link href={`/centrale/ressources/${state.resourceId}`} className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">
          Voir la ressource
        </Link>
      </div>
    );
  }

  const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="offer" value={offerCode} />
      {state && "error" in state && <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{state.error}</p>}
      <label className="block text-sm font-medium">
        Nom de la ressource
        <input name="name" required maxLength={60} defaultValue={defaultName} pattern="[a-z0-9-]+" title="Minuscules, chiffres et tirets" className={`${input} font-mono`} />
      </label>
      {projects.length > 0 && (
        <label className="block text-sm font-medium">
          Pour le projet (facultatif)
          <select name="project_id" defaultValue={projectId ?? ""} className={input}>
            <option value="">Aucun</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {squads.length > 0 && (
        <label className="block text-sm font-medium">
          Pour la Squad (facultatif : ses membres verront la ressource)
          <select name="squad_id" defaultValue={squadId ?? ""} className={input}>
            <option value="">Aucune</option>
            {squads.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button disabled={pending} className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink disabled:opacity-50">
        {pending ? "Création…" : "Créer en un clic"}
      </button>
    </form>
  );
}
