"use client";

import { useState } from "react";
import { AUDIT_NDA_CLAUSES, AUDIT_NDA_NOTICE, AUDIT_NDA_VERSION } from "@/lib/forensic-nda";

export function ConfidentialityFields() {
  const [confidentiality, setConfidentiality] = useState<"private" | "public">("private");

  return (
    <>
      <fieldset className="text-sm">
        <legend className="font-medium">Confidentialité</legend>
        <label className="mt-1 flex items-start gap-2">
          <input
            type="radio"
            name="confidentiality"
            value="private"
            checked={confidentiality === "private"}
            onChange={() => setConfidentiality("private")}
            className="mt-1"
          />
          <span>
            <strong>Confidentiel</strong> : seuls toi, les auditeurs et la modération voient le dépôt et les constats. Le certificat
            (score et synthèse) reste partageable.
          </span>
        </label>
        <label className="mt-1 flex items-start gap-2">
          <input
            type="radio"
            name="confidentiality"
            value="public"
            checked={confidentiality === "public"}
            onChange={() => setConfidentiality("public")}
            className="mt-1"
          />
          <span>
            <strong>Public</strong> : le rapport complet est visible de tous (projets open source).
          </span>
        </label>
      </fieldset>
      {confidentiality === "private" && (
        <section className="rounded-xl border border-border bg-background p-4 text-sm">
          <h2 className="font-semibold">Accord de confidentialité · {AUDIT_NDA_VERSION}</h2>
          <p className="mt-1 text-xs text-muted">{AUDIT_NDA_NOTICE}</p>
          <ul className="mt-3 space-y-2">
            {AUDIT_NDA_CLAUSES.map((clause) => (
              <li key={clause.title}>
                <strong>{clause.title}.</strong> {clause.text}
              </li>
            ))}
          </ul>
          <label className="mt-4 flex items-start gap-2 border-t border-border pt-3">
            <input type="checkbox" name="nda" required className="mt-1" />
            <span>J’ai lu et compris ces clauses provisoires et m’engage à les respecter.</span>
          </label>
        </section>
      )}
    </>
  );
}
