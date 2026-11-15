"use client";

import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CheckRepoButton({ projectId }: { projectId: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/projects/${projectId}/check`, { method: "POST" });
          if (!res.ok) setError((await res.json()).error);
          setBusy(false);
          router.refresh();
        }}
        className="text-primary hover:underline disabled:opacity-50"
      >
        {busy ? t("Vérification…") : t("Vérifier maintenant")}
      </button>
      {error && <span className="ml-2 text-danger">{error}</span>}
    </>
  );
}
