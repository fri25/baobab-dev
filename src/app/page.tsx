import Link from "next/link";
import { LEVELS } from "@/lib/levels";

const PILLARS = [
  {
    title: "Se rencontrer",
    text: "Profil pré-rempli depuis GitHub, matching par compétences, classements par ville et par pays.",
  },
  {
    title: "Échanger",
    text: "Questions-réponses, le Griot sur l'app et WhatsApp, Pair-Debugging à moins de 5 Ko/s.",
  },
  {
    title: "Partager",
    text: "Le Showroom des projets africains, ton activité GitHub en direct, la Stack Afrique vérifiée.",
  },
  {
    title: "Collaborer",
    text: "Des Squads formées par compétences, du débogage à plusieurs, des audits entre pairs.",
  },
  {
    title: "Gagner",
    text: "Primes de la Micro-Bourse, clone IA, missions. Versements en Mobile Money, Wave ou Orange Money.",
  },
];

const LOOP = [
  { step: "Aider", text: "Tu réponds, le Griot cite ta réponse : +5 XP à chaque citation." },
  { step: "Construire", text: "Tu publies ton projet, tu montes une Squad, tu débogues à plusieurs." },
  { step: "Être reconnu", text: "XP, niveaux et badges visibles sur ton profil et dans les classements." },
  { step: "Gagner", text: "Tu résous des tickets payés au code qui fonctionne, versés en Mobile Money." },
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:pt-20">
        <p className="mb-4 inline-block rounded-full border border-border px-3 py-1 text-xs text-muted">
          Pour les devs, par les devs · Bénin · Côte d&apos;Ivoire · Sénégal · Togo · Burkina Faso
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Ailleurs, l&apos;IA a vidé les forums de développeurs.{" "}
          <span className="text-primary">Chez nous, elle fait vivre la communauté.</span>
        </h1>
        <p className="mt-5 max-w-3xl text-xl font-semibold">La parole des sages, l’expertise en plus.</p>
        <p className="mt-2 max-w-3xl text-base leading-relaxed">
          Comme un véritable griot moderne, notre assistant fait résonner la voix de la communauté, cite ses auteurs et distribue des XP. En quête de vérité absolue ? Le Griot consulte ses sources ou en appelle à l’œil d’un expert.
        </p>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Baobab Dev est l&apos;endroit où les développeurs africains s&apos;entraident, montrent ce qu&apos;ils
          construisent, collaborent et gagnent leur vie grâce à leur expertise. Léger, mobile d&apos;abord, payé en
          Mobile Money.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/griot"
            className="rounded-full bg-primary px-6 py-3 font-medium text-primary-ink hover:opacity-90"
          >
            Découvrir le Griot
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-border px-6 py-3 font-medium hover:bg-surface"
          >
            Rejoindre avec GitHub
          </Link>
          <Link
            href="/u/aicha"
            className="rounded-full border border-border px-6 py-3 font-medium hover:bg-surface"
          >
            Voir un profil
          </Link>
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-5xl gap-px px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
          {PILLARS.map((p) => (
            <div key={p.title} className="py-3 lg:pr-5">
              <h2 className="font-semibold">{p.title}</h2>
              <p className="mt-1 text-sm text-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-2xl font-bold">Une boucle simple</h2>
        <p className="mt-2 text-muted">
          Chaque réponse validée nourrit le Griot, qui aide plus de devs et récompense ses auteurs.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map((l, i) => (
            <li key={l.step} className="rounded-xl border border-border bg-surface p-5">
              <span className="text-sm font-mono text-primary">0{i + 1}</span>
              <h3 className="mt-1 font-semibold">{l.step}</h3>
              <p className="mt-1 text-sm text-muted">{l.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="text-2xl font-bold">De la Graine à la Légende</h2>
        <p className="mt-2 text-muted">
          Sept niveaux. À partir d&apos;Expert, tu peux créer ton clone IA et arbitrer la Micro-Bourse.
        </p>
        <ol className="mt-6 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <li key={l.level} className="rounded-full border border-border bg-surface px-4 py-2 text-sm">
              <span className="font-medium">{l.name}</span>
              <span className="ml-2 text-muted">{l.floor.toLocaleString("fr-FR")} XP</span>
            </li>
          ))}
        </ol>
      </section>

    </main>
  );
}
