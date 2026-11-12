import { requireSession } from "@/lib/auth";
import { ImageUploader } from "@/components/ImageUploader";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { createQuestion } from "../actions";
import { TitleWithSuggestions } from "./SimilarQuestions";

export const metadata = { title: "Poser une question · Baobab Dev" };

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user } = await requireSession("/questions/new");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Poser une question</h1>
      <p className="mt-1 text-muted">Les experts des technologies indiquées sont notifiés.</p>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <form action={createQuestion} className="mt-6 space-y-5">
        <TitleWithSuggestions />
        <div>
          <label className="block text-sm font-medium" htmlFor="body">
            Description
          </label>
          <MarkdownEditor
            draftKey="question"
            id="body"
            name="body"
            label="Description"
            required
            rows={10}
            placeholder="Décris le problème, ce que tu as essayé et le résultat attendu…"
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
            placeholder="Laravel, FedaPay, PHP"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
          />
        </div>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Publier</button>
      </form>
    </main>
  );
}
