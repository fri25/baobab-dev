import { Logo } from "@/components/Logo";
import { translator } from "@/lib/i18n/shared";

export const metadata = { title: "Hors connexion · Offline · Baobab Dev" };
// Page statique mise en cache par le service worker : elle ne peut pas lire la langue choisie,
// elle s'affiche donc dans les deux langues.
export const dynamic = "force-static";

const TITLE = "Pas de connexion";
const BODY =
  "Cette page n'a pas encore été consultée sur ce téléphone. Les questions et projets déjà ouverts restent lisibles hors connexion, et tes brouillons sont sauvegardés.";

export default function OfflinePage() {
  const en = translator("en");
  return (
    <main className="mx-auto flex max-w-sm flex-col items-center px-4 py-20 text-center">
      <Logo className="h-14 w-14" />
      <h1 className="mt-4 text-xl font-bold">{TITLE}</h1>
      <p className="mt-2 text-muted">{BODY}</p>
      <h2 lang="en" className="mt-8 text-lg font-bold">{en(TITLE)}</h2>
      <p lang="en" className="mt-2 text-muted">{en(BODY)}</p>
    </main>
  );
}
