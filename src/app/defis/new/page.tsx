import { getT, pageTitle } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createChallenge } from "../actions";

export async function generateMetadata() {
  return { title: await pageTitle("Lancer un défi · Baobab Dev") };
}

const STARTER_HINT = "function rendreMonnaie(montant, valeurs) {\n  return -1;\n}";
const TESTS_HINT = '[\n  { "args": [30, [25, 10]], "expected": 3, "public": true },\n  { "args": [7, [5, 10]], "expected": -1 }\n]';

const input ="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewChallengePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  const { profile } = await requireSession("/defis/new");
  if (!["moderator", "admin"].includes(profile.role)) notFound();
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Lancer un défi")}</h1>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <form action={createChallenge} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t("Titre")}
          <input name="title" required className={input} />
        </label>
        <label className="block text-sm font-medium">
          {t("Énoncé (``` pour le code)")}
          <textarea name="description" required rows={8} className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Type")}
            <select name="kind" className={input}>
              <option value="algo">{t("Algorithmique")}</option>
              <option value="interface">{t("Interface")}</option>
              <option value="api">{t("API")}</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            {t("Durée (jours)")}
            <input name="days" type="number" min={1} max={30} defaultValue={7} className={input} />
          </label>
        </div>
        <fieldset className="space-y-4 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold">{t("Correction")}</legend>
          <label className="block text-sm font-medium">
            {t("Mode")}
            <select name="grading" className={input}>
              <option value="jury">{t("Par le jury")}</option>
              <option value="auto">{t("Automatique (JavaScript, tests publics et cachés)")}</option>
            </select>
          </label>
          <p className="text-xs text-muted">{t("Les champs ci-dessous ne servent qu'à la correction automatique.")}</p>
          <label className="block text-sm font-medium">
            {t("Nom de la fonction à écrire")}
            <input name="function_name" placeholder={t("rendreMonnaie")} className={`${input} font-mono`} />
          </label>
          <label className="block text-sm font-medium">
            {t("Code de départ (facultatif)")}
            <textarea name="starter_code" rows={4} className={`${input} font-mono text-sm`} placeholder={STARTER_HINT} />
          </label>
          <label className="block text-sm font-medium">
            {t("Tests (JSON) : au moins un public et un caché")}
            <textarea
              name="tests"
              rows={6}
              className={`${input} font-mono text-sm`}
              placeholder={TESTS_HINT}
            />
          </label>
          <label className="block text-sm font-medium">
            {t("Solution de référence (facultatif, non publiée) : elle doit réussir tous les tests")}
            <textarea name="reference_code" rows={4} className={`${input} font-mono text-sm`} />
          </label>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Sponsor (facultatif)")}
            <input name="sponsor_name" className={input} />
          </label>
          <label className="block text-sm font-medium">
            {t("Site du sponsor")}
            <input name="sponsor_url" type="url" className={input} />
          </label>
        </div>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">{t("Publier le défi")}</button>
      </form>
    </main>
  );
}
