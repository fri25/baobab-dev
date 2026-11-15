"use client";

import { useT } from "@/lib/i18n/client";
import { useActionState } from "react";
import { submitAutoSolution, type AutoState } from "../actions";

export function AutoSubmitForm({ challengeId, initialCode, hasSubmission }: { challengeId: string; initialCode: string; hasSubmission: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<AutoState, FormData>(submitAutoSolution.bind(null, challengeId), {});
  const report = state.report;

  return (
    <form action={action} className="mt-6 space-y-3 rounded-xl border border-dashed border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{t("Ta solution (JavaScript)")}</h2>
        <span className="text-xs text-muted">{t("Fonction synchrone · 1 s par test · pas d'accès réseau ni fichiers")}</span>
      </div>
      <textarea
        name="code"
        required
        rows={14}
        spellCheck={false}
        defaultValue={state.code ?? initialCode}
        aria-label={t("Code de ta solution")}
        className="w-full rounded-lg border border-border bg-[#1f1a14] p-3 font-mono text-sm text-[#f3ece2]"
      />
      {!hasSubmission && (
        <input name="note" maxLength={200} placeholder={t("Un mot sur ton approche (facultatif)")} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
      )}
      <div className="flex flex-wrap gap-2">
        <button name="mode" value="test" disabled={pending} className="rounded-full border border-border px-5 py-2 text-sm font-medium disabled:opacity-50">
          {t("Tester sur les exemples")}
        </button>
        <button name="mode" value="submit" disabled={pending} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink disabled:opacity-50">
          {hasSubmission ? t("Soumettre à nouveau") : t("Soumettre")}
        </button>
        {pending && <span className="self-center text-sm text-muted">{t("Correction en cours…")}</span>}
      </div>

      {state.error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{state.error}</p>}
      {report && (
        <div aria-live="polite" className="space-y-2">
          {report.error ? (
            <p className="rounded-lg bg-danger/10 p-3 font-mono text-sm text-danger">{report.error}</p>
          ) : (
            <p className={`rounded-lg p-3 text-sm font-medium ${report.passed === report.total ? "bg-leaf/10 text-leaf" : "bg-gold/10"}`}>
              {state.mode === "test" ? t("Exemples") : t("Tests")}{" "}{t("réussis :")}{" "}{report.passed}/{report.total}
              {state.mode === "submit" && ` · ${report.score}/100`}
            </p>
          )}
          {state.message && <p className="text-sm">{state.message}</p>}
          <ul className="space-y-1 text-sm">
            {report.results.map((r) => (
              <li key={r.index} className="rounded-lg border border-border bg-surface px-3 py-2">
                <span className={r.pass ? "text-leaf" : "text-danger"}>{r.pass ? "✓" : "✗"}</span>{" "}{t("Test")}{" "}{r.index}
                {r.public ? "" : t(" (caché)")}
                {r.ms !== null && <span className="text-xs text-muted"> · {r.ms}{" "}{t("ms")}</span>}
                {r.public && !r.pass && (
                  <div className="mt-1 space-y-0.5 font-mono text-xs text-muted">
                    <div>{t("entrée :")}{" "}{r.args}</div>
                    <div>{t("attendu :")}{" "}{r.expected}</div>
                    <div>{t("obtenu :")}{" "}{r.error ?? r.got}</div>
                  </div>
                )}
                {!r.public && r.error && <span className="text-xs text-muted"> · {r.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
