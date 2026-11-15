import { getT, pageTitle } from "@/lib/i18n/server";
import { requireSession } from "@/lib/auth";
import { STACK_CATEGORY } from "@/lib/labels";
import { proposeStackItem } from "../actions";

export async function generateMetadata() {
  return { title: await pageTitle("Proposer un outil · Stack Afrique") };
}

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewStackItemPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  await requireSession("/stack/new");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Proposer un outil")}</h1>
      <p className="mt-1 text-muted">{t("Il démarre « en test » et devient « vérifié » avec 5 devs en production.")}</p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <form action={proposeStackItem} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Nom")}
            <input name="name" required className={input} />
          </label>
          <label className="block text-sm font-medium">
            {t("Catégorie")}
            <select name="category" className={input}>
              {Object.entries(STACK_CATEGORY).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t("Description")}
          <textarea name="description" required rows={3} className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Site officiel")}
            <input name="website" type="url" className={input} />
          </label>
          <label className="block text-sm font-medium">
            {t("Documentation")}
            <input name="docs_url" type="url" className={input} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t("Versions compatibles")}
          <input name="compatible_versions" placeholder={t("SDK PHP 0.4+, Laravel 9 à 11")} className={input} />
        </label>
        <label className="block text-sm font-medium">
          {t("Exemple de code (``` pour le bloc)")}
          <textarea name="code_example" rows={5} className={`${input} font-mono text-sm`} />
        </label>
        <label className="block text-sm font-medium">
          {t("Pièges connus (une ligne par piège, commençant par « - »)")}
          <textarea name="pitfalls" rows={3} className={input} />
        </label>
        <label className="block text-sm font-medium">
          {t("URL publique à surveiller (alerte en cas de panne)")}
          <input name="health_url" type="url" placeholder={t("https://api.exemple.com")} className={input} />
        </label>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">{t("Proposer")}</button>
      </form>
    </main>
  );
}
