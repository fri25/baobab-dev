import { requireSession } from "@/lib/auth";
import { createSquad } from "../actions";

export const metadata = { title: "Monter une Squad · Baobab Dev" };

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewSquadPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireSession("/squads/new");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Monter une Squad</h1>
      <p className="mt-1 text-muted">Le matching te proposera des profils selon les compétences demandées.</p>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <form action={createSquad} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Nom de la Squad
          <input name="name" required maxLength={80} className={input} />
        </label>
        <label className="block text-sm font-medium">
          Le projet et ce que tu attends
          <textarea name="description" required rows={4} className={input} />
        </label>
        <label className="block text-sm font-medium">
          Rôles recherchés (séparés par des virgules)
          <input name="roles" placeholder="Back-end Node.js, Designer UI" className={input} />
        </label>
        <label className="block text-sm font-medium">
          Compétences pour le matching (séparées par des virgules)
          <input name="skills" required placeholder="Node.js, Flutter, PostgreSQL" className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Durée (semaines)
            <input name="duration_weeks" type="number" min={1} max={52} className={input} />
          </label>
          <label className="block text-sm font-medium">
            Engagement attendu
            <input name="commitment" placeholder="5 h / semaine" className={input} />
          </label>
        </div>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Créer la Squad</button>
      </form>
    </main>
  );
}
