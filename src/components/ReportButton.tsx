import { getT } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";

type Target = "question" | "answer" | "project" | "comment" | "profile" | "griot_query" | "message" | "audit_finding";

export async function ReportButton({ targetType, targetId, path }: { targetType: Target; targetId: string; path: string }) {
  const t = await getT();
  async function report(formData: FormData) {
    "use server";
    const { supabase, user } = await requireSession(path);
    await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason: String(formData.get("reason") || "Contenu inapproprié"),
    });
    revalidatePath(path);
  }

  return (
    <details className="relative inline-block text-xs">
      <summary className="cursor-pointer list-none text-muted hover:text-primary">{t("Signaler")}</summary>
      <form action={report} className="absolute right-0 z-10 mt-1 w-56 space-y-2 rounded-lg border border-border bg-surface p-3 shadow">
        <select name="reason" className="w-full rounded border border-border bg-background p-1">
          <option>{t("Contenu inapproprié")}</option>
          <option>{t("Spam ou publicité")}</option>
          <option>{t("Réponse fausse ou dangereuse")}</option>
          <option>{t("Plagiat")}</option>
        </select>
        <button className="w-full rounded bg-primary py-1 text-primary-ink">{t("Envoyer")}</button>
      </form>
    </details>
  );
}
