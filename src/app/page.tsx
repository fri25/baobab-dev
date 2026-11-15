import { dateLocale } from "@/lib/i18n/current";
import { getT } from "@/lib/i18n/server";
import Image from "next/image";
import Link from "next/link";
import { EcosystemCarousel } from "@/app/EcosystemCarousel";
import { TechMarquee } from "@/app/TechMarquee";
import { LEVELS } from "@/lib/levels";

// Comment ça marche : quatre étapes concrètes, sans slogan
const STEPS = [
  {
    title: "Aider",
    text: "Réponds aux questions dans tes technologies. Une réponse validée te rapporte 25 XP, puis 5 XP chaque fois que le Griot la cite.",
  },
  {
    title: "Construire",
    text: "Publie ton projet dans le Showroom, trouve des coéquipiers dans une Squad, débogue à plusieurs avec le Pair-Debugging.",
  },
  {
    title: "Être reconnu",
    text: "Tes XP et tes badges viennent de ce que tu as fait : réponses validées, projets, défis. Ton profil le montre aux recruteurs.",
  },
  {
    title: "Gagner",
    text: "Corrige un ticket de la Micro-Bourse ou ouvre ton clone IA. Les primes sont versées en Mobile Money.",
  },
];

const PERKS = ["Optimisé 3G & PWA", "Citations & +5 XP", "Gains en Mobile Money"];

export default async function Home() {
  const t = await getT();
  return (
    <main className="overflow-x-hidden">
      {/* Accueil */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-5 flex items-center gap-2 text-sm text-muted">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-leaf" />
            <span>
              {t("Coupe d'Afrique des Développeurs 2026")}
              <span className="hidden sm:inline">{" "}{t("· Panafricain & Ouvert")}</span>
            </span>
          </p>

          <h1 className="text-3xl font-extrabold leading-[1.12] tracking-tight break-words sm:text-5xl lg:text-6xl">
            {t("Ailleurs, l'IA a vidé les forums de dev.")}{" "}
            <span className="text-primary">{t("Chez nous, elle fait vivre la communauté.")}</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {t("La plateforme d'échange conçue pour les réalités du continent africain : smartphone d'entrée de gamme, réseau 3G, entraide récompensée et paiements en Mobile Money.")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-ink transition hover:opacity-90"
            >
              {t("Rejoindre avec GitHub")}
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/griot"
              className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold transition hover:border-foreground/40"
            >
              {t("Découvrir le Griot")}
            </Link>
          </div>

          <ul className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted sm:flex-row sm:gap-6">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2">
                <span aria-hidden="true" className="font-bold text-leaf">✓</span>
                {t(perk)}
              </li>
            ))}
          </ul>
        </div>

        {/* Exemple d'échange avec le Griot */}
        <div className="mx-auto w-full max-w-lg min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 overflow-hidden rounded-full border border-border">
                <Image
                  src="/griot-avatar.jpg"
                  alt={t("Avatar du Griot")}
                  fill
                  sizes="44px"
                  className="object-cover object-[50%_42%]"
                  priority
                />
              </div>
              <div>
                <p className="flex items-center gap-2 font-bold">
                  {t("Le Griot")}
                  <span className="rounded border border-border px-1.5 font-mono text-[10px] font-semibold text-muted">{t("IA SOURCÉE")}</span>
                </p>
                <p className="text-xs text-muted">{t("La parole des sages, l'expertise de l'Afrique.")}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 py-5 text-sm leading-relaxed">
            <p className="max-w-[90%] rounded-xl bg-background p-3 text-muted">
              {t("Je réponds uniquement à partir des contributions validées des développeurs du continent.")}
            </p>
            <p className="ml-auto max-w-[85%] rounded-xl bg-primary p-3 font-medium text-primary-ink">
              {t("Comment intégrer FedaPay ou Wave dans une application Laravel ?")}
            </p>
            <div className="max-w-[95%] rounded-xl border border-border p-3 sm:p-4">
              <p>
                {t("Utilise le webhook signé")}{" "}
                <code className="break-all rounded bg-background px-1.5 py-0.5 font-mono text-xs">X-FEDAPAY-SIGNATURE</code>{" "}
                {t("pour valider la notification de paiement sans dépendre d'une redirection navigateur instable.")}
              </p>
              <div className="mt-3 flex flex-col justify-between gap-2 border-t border-border pt-3 text-xs sm:flex-row sm:items-center">
                <span>
                  <span className="font-semibold text-leaf">{t("✓ Réponse certifiée")}</span>{" "}
                  <span className="text-muted">{t("par @koffi (Abidjan)")}</span>
                </span>
                <span className="font-mono font-bold text-primary">{t("+5 XP pour l'auteur")}</span>
              </div>
            </div>
          </div>

          <p className="border-t border-border pt-4 text-xs text-muted">{t("Chaque réponse enrichit la mémoire collective")}</p>
        </div>
      </section>

      <TechMarquee />

      {/* Ce qu'on trouve sur la plateforme */}
      <section className="border-y border-border py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("Ce que tu trouves sur Baobab Dev")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              {t("Poser une question, montrer ton projet, monter une équipe, être payé pour un bug corrigé. Il suffit d'un compte GitHub.")}
            </p>
          </div>
          <EcosystemCarousel />
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("Comment ça marche")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              {t("Tu réponds à une question. Si ta réponse est validée, le Griot peut s'en servir pour aider d'autres devs, et il te cite à chaque fois.")}
            </p>
          </div>
          <Link href="/questions" className="text-sm font-bold text-primary hover:underline">
            {t("Explorer toutes les questions")} <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ol className="mt-10 grid gap-8 border-t border-border pt-8 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <p className="font-mono text-sm font-bold text-primary">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 text-lg font-bold">{t(step.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(step.text)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Niveaux */}
      <section className="border-y border-border py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("Sept niveaux, de Graine à Légende Baobab")}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                {t("Au niveau Expert (2 000 XP), tu peux créer ton clone IA et arbitrer les litiges de la Micro-Bourse.")}
              </p>
            </div>
            <Link href="/classements" className="text-sm font-bold text-primary hover:underline">
              {t("Consulter le classement")} <span aria-hidden="true">→</span>
            </Link>
          </div>

          <ol aria-label={t("Niveaux de progression XP")} className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {LEVELS.map((level, index) => (
              <li key={level.level} className="rounded-lg border border-border p-4">
                <p className="font-mono text-[11px] text-muted">
                  {t("Niveau {n}", { n: level.level })}
                </p>
                <p className="mt-2 text-sm font-bold">{level.name}</p>
                <p className="mt-1 font-mono text-xs font-semibold text-primary">
                  {level.floor.toLocaleString(dateLocale())} {t("XP")}
                </p>
                <div aria-hidden="true" className="mt-3 h-1 rounded-full bg-border">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${((index + 1) / LEVELS.length) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Inscription */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-border bg-surface p-8 sm:p-12 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("Prêt·e à bâtir la tech africaine de demain ?")}</h2>
            <p className="mt-3 text-base leading-relaxed text-muted">
              {t("Connecte ton compte GitHub en 10 secondes, partage ton savoir et participe aux défis de la communauté.")}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 font-bold text-primary-ink transition hover:opacity-90 sm:w-auto"
          >
            {t("Rejoindre Baobab Dev")}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
