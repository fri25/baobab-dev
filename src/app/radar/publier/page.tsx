import { getT, pageTitle } from "@/lib/i18n/server";
import { requireSession } from "@/lib/auth";
import { ORG_TYPE } from "@/lib/radar-labels";
import { draftOpportunity } from "../actions";

export async function generateMetadata() {
  return { title: await pageTitle("Publier un besoin · Radar") };
}

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function PublishPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  const { profile } = await requireSession("/radar/publier");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Publier un besoin numérique")}</h1>
      <p className="mt-1 text-muted">
        {t("PME, ONG, mairie ou startup : décris ton besoin avec tes mots, ou colle un appel d'offres. Le Radar en extrait les technologies, le budget et le délai, puis alerte les devs et les Squads qui correspondent.")}
      </p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <form action={draftOpportunity} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Organisation")}
            <input
              name="organization_name"
              defaultValue={profile.role === "organization" ? undefined : ""}
              placeholder={t("Mairie de Cotonou")}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            {t("Type")}
            <select name="org_type" defaultValue={profile.role === "organization" ? "collectivite" : "pme"} className={input}>
              {Object.entries(ORG_TYPE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t("Le besoin")}
          <textarea
            name="raw_text"
            required
            minLength={40}
            rows={8}
            placeholder={t("Nous voulons permettre aux commerçants du marché de payer leurs taxes par Mobile Money, même sans smartphone. Budget : 8 à 12 millions FCFA, réponses avant le 15/12/2026.")}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("Contact (email ou téléphone, visible des devs connectés)")}
          <input name="contact" className={input} />
        </label>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">{t("Analyser le besoin")}</button>
        <p className="text-xs text-muted">{t("Tu pourras relire et corriger l'extraction avant de publier.")}</p>
      </form>
    </main>
  );
}
