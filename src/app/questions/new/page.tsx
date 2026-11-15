import { getT, pageTitle } from "@/lib/i18n/server";
import { requireSession } from "@/lib/auth";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { ImageUploader } from "@/components/ImageUploader";
import { createQuestion } from "../actions";
import { TitleWithSuggestions } from "./SimilarQuestions";

export async function generateMetadata() {
  return { title: await pageTitle("Poser une question · Baobab Dev") };
}

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  const { user } = await requireSession("/questions/new");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Poser une question")}</h1>
      <p className="mt-1 text-muted">{t("Les experts des technologies indiquées sont notifiés.")}</p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <form action={createQuestion} className="mt-6 space-y-5">
        <TitleWithSuggestions />
        <div>
          <label className="block text-sm font-medium" htmlFor="body">
            {t("Description")}
          </label>
          <p className="text-xs text-muted">{t("Ce que tu essaies de faire, ce que tu as tenté, le message d'erreur. Utilise la barre d'outils ou le Markdown, puis vérifie l'aperçu.")}</p>
          <MarkdownEditor
            draftKey="question"
            id="body"
            name="body"
            required
            rows={12}
            placeholder={t("J'essaie de…\n\n```php\n// le code concerné\n```\n\nErreur obtenue : …")}
          />
        </div>
        <ImageUploader userId={user.id} />
        <div>
          <label className="block text-sm font-medium" htmlFor="tags">
            {t("Technologies (séparées par des virgules, 5 max.)")}
          </label>
          <input
            id="tags"
            name="tags"
            placeholder={t("Laravel, FedaPay, PHP")}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
          />
        </div>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">{t("Publier")}</button>
      </form>
    </main>
  );
}
