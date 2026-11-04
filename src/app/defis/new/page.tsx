import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createChallenge } from "../actions";

export const metadata = { title: "Lancer un défi · Baobab Dev" };

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewChallengePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { profile } = await requireSession("/defis/new");
  if (!["moderator", "admin"].includes(profile.role)) notFound();
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Lancer un défi</h1>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}
      <form action={createChallenge} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Titre
          <input name="title" required className={input} />
        </label>
        <label className="block text-sm font-medium">
          Énoncé (``` pour le code)
          <textarea name="description" required rows={8} className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Type
            <select name="kind" className={input}>
              <option value="algo">Algorithmique</option>
              <option value="interface">Interface</option>
              <option value="api">API</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Durée (jours)
            <input name="days" type="number" min={1} max={30} defaultValue={7} className={input} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Sponsor (facultatif)
            <input name="sponsor_name" className={input} />
          </label>
          <label className="block text-sm font-medium">
            Site du sponsor
            <input name="sponsor_url" type="url" className={input} />
          </label>
        </div>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Publier le défi</button>
      </form>
    </main>
  );
}
