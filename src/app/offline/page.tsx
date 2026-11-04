import { Logo } from "@/components/Logo";

export const metadata = { title: "Hors connexion · Baobab Dev" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col items-center px-4 py-20 text-center">
      <Logo className="h-14 w-14" />
      <h1 className="mt-4 text-xl font-bold">Pas de connexion</h1>
      <p className="mt-2 text-muted">
        Cette page n&apos;a pas encore été consultée sur ce téléphone. Les questions et projets déjà ouverts restent
        lisibles hors connexion, et tes brouillons sont sauvegardés.
      </p>
    </main>
  );
}
