import { requireSession } from "@/lib/auth";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { createProject } from "../actions";

export const metadata = { title: "Publier un projet · Baobab Dev" };

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireSession("/showroom/new");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Publier un projet</h1>
      <p className="mt-1 text-muted">+15 XP et le badge Bâtisseur à la première publication.</p>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <form action={createProject} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Nom
          <input name="name" required maxLength={80} className={input} />
        </label>
        <div>
          <label htmlFor="description" className="block text-sm font-medium">Description</label>
          <MarkdownEditor
            draftKey="project-description"
            id="description"
            name="description"
            label="Description du projet"
            required
            rows={7}
            placeholder="Présente le problème, la solution et ce qui rend ton projet utile…"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Démo (URL)
            <input name="demo_url" type="url" className={input} />
          </label>
          <label className="block text-sm font-medium">
            Dépôt (URL)
            <input name="repo_url" type="url" placeholder="https://github.com/…" className={input} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Stack (séparée par des virgules)
            <input name="stack" placeholder="Laravel, FedaPay, MySQL" className={input} />
          </label>
          <label className="block text-sm font-medium">
            Statut
            <select name="status" className={input}>
              <option value="idea">Idée</option>
              <option value="building">En construction</option>
              <option value="launched">Lancé</option>
            </select>
          </label>
        </div>

        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">
            <input type="checkbox" name="contributors" className="mr-2" />
            Je cherche des contributeurs (crée une Squad)
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              Rôles recherchés (séparés par des virgules)
              <input name="roles" placeholder="Back-end Node.js, Mobile Flutter" className={input} />
            </label>
            <label className="block text-sm">
              Ce que tu attends des contributeurs
              <textarea name="squad_need" rows={2} className={input} />
            </label>
          </div>
        </details>

        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Publier</button>
      </form>
    </main>
  );
}
