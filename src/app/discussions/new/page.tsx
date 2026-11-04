import { requireSession } from "@/lib/auth";
import { createTopic } from "../actions";

export const metadata = { title: "Lancer un sujet · Baobab Dev" };

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewTopicPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireSession("/discussions/new");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Lancer un sujet</h1>
      <p className="mt-1 text-muted">Un salon de discussion ouvert à toute la communauté.</p>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}
      <form action={createTopic} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Sujet
          <input name="title" required minLength={3} maxLength={80} placeholder="Ex. Déployer Laravel sur un VPS à petit prix" className={input} />
        </label>
        <label className="block text-sm font-medium">
          De quoi parle-t-on ?
          <textarea name="description" rows={3} className={input} />
        </label>
        <label className="block text-sm font-medium">
          Technologies ou thèmes (séparés par des virgules)
          <input name="tags" placeholder="Laravel, hébergement" className={input} />
        </label>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Créer le sujet</button>
      </form>
    </main>
  );
}
