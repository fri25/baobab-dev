"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReanalyzeButton({ auditId }: { auditId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/forensic/${auditId}/analyze`, { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
      className="mt-2 rounded-full border border-border px-3 py-1 text-xs hover:bg-background disabled:opacity-50"
    >
      {busy ? "Analyse en cours…" : "Relancer l'analyse automatique"}
    </button>
  );
}
