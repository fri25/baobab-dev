import { getT, pageTitle } from "@/lib/i18n/server";
import { requireSession } from "@/lib/auth";
import { createSquad } from "../actions";

export async function generateMetadata() {
  return { title: await pageTitle("Monter une Squad · Baobab Dev") };
}

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewSquadPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  await requireSession("/squads/new");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Monter une Squad")}</h1>
      <p className="mt-1 text-muted">{t("Le matching te proposera des profils selon les compétences demandées.")}</p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <form action={createSquad} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t("Nom de la Squad")}
          <input name="name" required maxLength={80} className={input} />
        </label>
        <label className="block text-sm font-medium">
          {t("Le projet et ce que tu attends")}
          <textarea name="description" required rows={4} className={input} />
        </label>
        <label className="block text-sm font-medium">
          {t("Rôles recherchés (séparés par des virgules)")}
          <input name="roles" placeholder={t("Back-end Node.js, Designer UI")} className={input} />
        </label>
        <label className="block text-sm font-medium">
          {t("Compétences pour le matching (séparées par des virgules)")}
          <input name="skills" required placeholder={t("Node.js, Flutter, PostgreSQL")} className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Durée (semaines)")}
            <input name="duration_weeks" type="number" min={1} max={52} className={input} />
          </label>
          <label className="block text-sm font-medium">
            {t("Engagement attendu")}
            <input name="commitment" placeholder={t("5 h / semaine")} className={input} />
          </label>
        </div>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">{t("Créer la Squad")}</button>
      </form>
    </main>
  );
}
