import { getT, pageTitle } from "@/lib/i18n/server";
import { requireSession } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { createAudit } from "../actions";

export async function generateMetadata() {
  return { title: await pageTitle("Lancer l'audit · Code Forensic") };
}

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewAuditPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  const { supabase, user } = await requireSession("/forensic/new");
  const { error } = await searchParams;
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Lancer l'audit")}</h1>
      <p className="mt-1 text-muted">
        {t("Le forfait est bloqué dès maintenant. 70 % vont aux auditeurs dont les constats sont maintenus ; sans auditeur avant l'échéance, il t'est remboursé. Solde :")}{" "}<strong>{fcfa(wallet?.balance ?? 0)}</strong>
      </p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <form action={createAudit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t("Projet")}
          <input name="title" required placeholder={t("Tontine Pay avant la levée de fonds")} className={input} />
        </label>
        <label className="block text-sm font-medium">
          {t("Dépôt GitHub")}
          <input name="repo_url" type="url" required pattern="https://github\.com/.+/.+" placeholder={t("https://github.com/moi/mon-projet")} className={input} />
          <span className="mt-1 block text-xs font-normal text-muted">
            {t("Dépôt public : analyse automatique immédiate. Dépôt privé : invite les auditeurs sur GitHub une fois l'accord signé.")}
          </span>
        </label>
        <label className="block text-sm font-medium">
          {t("Contexte")}
          <textarea name="context" required rows={3} placeholder={t("Lancement, levée de fonds, reprise du code par une nouvelle équipe…")} className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            {t("Forfait (FCFA)")}
            <input name="fee" type="number" min={10000} step={1000} defaultValue={15000} required className={input} />
          </label>
          <label className="block text-sm font-medium">
            {t("Auditeurs")}
            <select name="max_auditors" defaultValue="3" className={input}>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            {t("Durée (jours)")}
            <input name="days" type="number" min={3} max={30} defaultValue={14} className={input} />
          </label>
        </div>
        <fieldset className="text-sm">
          <legend className="font-medium">{t("Confidentialité")}</legend>
          <label className="mt-1 flex items-start gap-2">
            <input type="radio" name="confidentiality" value="private" defaultChecked className="mt-1" />
            <span>
              <strong>{t("Confidentiel")}</strong>{" "}{t(": seuls toi, les auditeurs et la modération voient le dépôt et les constats. Chaque auditeur signe un accord de confidentialité généré automatiquement (8 clauses) avant d'accéder au code ; vous recevez tous les deux le PDF signé. Le certificat (score et synthèse) reste partageable.")}
            </span>
          </label>
          <label className="mt-1 flex items-start gap-2">
            <input type="radio" name="confidentiality" value="public" className="mt-1" />
            <span>
              <strong>{t("Public")}</strong>{" "}{t(": le rapport complet est visible de tous (projets open source).")}
            </span>
          </label>
        </fieldset>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">{t("Lancer l'audit")}</button>
        <p className="text-xs text-muted">{t("Le forfait est bloqué au lancement et remboursé si aucun auditeur n'intervient avant l'échéance.")}</p>
      </form>
    </main>
  );
}
