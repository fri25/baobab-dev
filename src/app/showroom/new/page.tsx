import { getT, pageTitle } from "@/lib/i18n/server";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { requireSession } from "@/lib/auth";
import { createProject } from "../actions";

export async function generateMetadata() {
  return { title: await pageTitle("Publier un projet · Baobab Dev") };
}

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  await requireSession("/showroom/new");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Publier un projet")}</h1>
      <p className="mt-1 text-muted">{t("+15 XP et le badge Bâtisseur à la première publication.")}</p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <form action={createProject} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t("Nom")}
          <input name="name" required maxLength={80} className={input} />
        </label>
        <div>
          <label className="block text-sm font-medium" htmlFor="description">
            {t("Description")}
          </label>
          <p className="text-xs text-muted">{t("Le problème résolu, pour qui, ce qui marche déjà. Mise en forme Markdown et aperçu.")}</p>
          <MarkdownEditor
            id="description"
            name="description"
            required
            rows={8}
            maxLength={5000}
            draftKey="projet"
            placeholder={t("## Le problème\nLes commerçants de Dantokpa…\n\n## Ce qui marche déjà\n- Paiement FedaPay\n- Mode hors ligne")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Démo (URL)")}
            <input name="demo_url" type="url" className={input} />
          </label>
          <label className="block text-sm font-medium">
            {t("Dépôt (URL)")}
            <input name="repo_url" type="url" placeholder={t("https://github.com/…")} className={input} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Stack (séparée par des virgules)")}
            <input name="stack" placeholder={t("Laravel, FedaPay, MySQL")} className={input} />
          </label>
          <label className="block text-sm font-medium">
            {t("Statut")}
            <select name="status" className={input}>
              <option value="idea">{t("Idée")}</option>
              <option value="building">{t("En construction")}</option>
              <option value="launched">{t("Lancé")}</option>
            </select>
          </label>
        </div>

        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">
            <input type="checkbox" name="contributors" className="mr-2" />
            {t("Je cherche des collaborateurs (crée une Squad)")}
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              {t("Rôles recherchés (séparés par des virgules)")}
              <input name="roles" placeholder={t("Back-end Node.js, Mobile Flutter")} className={input} />
            </label>
            <label className="block text-sm">
              {t("Ce que tu attends des collaborateurs")}
              <textarea name="squad_need" rows={2} className={input} />
            </label>
          </div>
        </details>

        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">{t("Publier")}</button>
      </form>
    </main>
  );
}
