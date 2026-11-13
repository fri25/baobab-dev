import { requireSession } from "@/lib/auth";
import { ImageUploader } from "@/components/ImageUploader";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { TitleWithSuggestions } from "@/app/questions/new/SimilarQuestions";
import { createTopic } from "../actions";

export const metadata = { title: "Lancer un sujet · Baobab Dev" };

export default async function NewTopicPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await requireSession("/discussions/new");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Lancer un sujet</h1>
      <p className="mt-1 text-muted">Un salon de discussion ouvert à toute la communauté.</p>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}
      <form action={createTopic} className="mt-6 space-y-5">
        <TitleWithSuggestions />
        <div>
          <label htmlFor="description" className="block text-sm font-medium">Description</label>
          <MarkdownEditor
            draftKey="discussion-topic"
            id="description"
            name="description"
            label="Description du sujet"
            required
            rows={10}
            placeholder="Présente le sujet, le contexte et les questions à explorer ensemble…"
          />
        </div>
        <ImageUploader userId={user.id} />
        <div>
          <label className="block text-sm font-medium" htmlFor="tags">
            Technologies (séparées par des virgules, 5 max.)
          </label>
          <input
            id="tags"
            name="tags"
            placeholder="Laravel, hébergement"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
          />
        </div>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Créer le sujet</button>
      </form>
    </main>
  );
}
