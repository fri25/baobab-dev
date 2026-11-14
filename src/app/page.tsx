import Image from "next/image";
import Link from "next/link";
import { EcosystemCarousel } from "@/app/EcosystemCarousel";
import { TechMarquee } from "@/app/TechMarquee";
import { LEVELS } from "@/lib/levels";

const LOOP = [
  { step: "Aider", text: "Tu réponds, le Griot cite ta réponse : +5 XP à chaque citation.", symbol: "↗" },
  { step: "Construire", text: "Tu publies ton projet, tu montes une Squad, tu débogues à plusieurs.", symbol: "⌘" },
  { step: "Être reconnu", text: "XP, niveaux et badges visibles sur ton profil et dans les classements.", symbol: "✦" },
  { step: "Gagner", text: "Tu résous des tickets payés au code qui fonctionne, versés en Mobile Money.", symbol: "₣" },
];

export default function Home() {
  return (
    <main className="landing-page">
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="landing-orb pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-violet/15 blur-3xl" />
        <div aria-hidden="true" className="landing-orb landing-orb-delay pointer-events-none absolute right-0 top-16 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:min-h-[38rem] lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-24">
          <div className="max-w-3xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/70 px-4 py-2 text-xs font-medium text-muted shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-leaf shadow-[0_0_12px_var(--leaf)]" />
              Pour les devs, par les devs · Afrique de l&apos;Ouest
            </p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Ailleurs, l&apos;IA a vidé les forums de développeurs.{" "}
              <span className="bg-gradient-to-r from-primary via-gold to-violet bg-clip-text text-transparent">
                Chez nous, elle fait vivre la communauté.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
              Une plateforme pour s&apos;entraider, construire ensemble et faire reconnaître l&apos;expertise des développeurs africains.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-gold px-6 py-3 font-semibold text-primary-ink shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25"
              >
                Rejoindre avec GitHub <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/griot"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-6 py-3 font-semibold backdrop-blur transition hover:border-violet/50 hover:bg-surface"
              >
                Découvrir le Griot
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-2"><span className="text-leaf">✓</span> Mobile d&apos;abord</span>
              <span className="inline-flex items-center gap-2"><span className="text-leaf">✓</span> Communauté africaine</span>
              <span className="inline-flex items-center gap-2"><span className="text-leaf">✓</span> XP pour contribuer</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/30 via-violet/25 to-tech/25 opacity-70 blur-2xl" />
            <div className="landing-border relative rounded-[1.75rem] p-px">
              <div className="relative overflow-hidden rounded-[calc(1.75rem-1px)] border border-white/10 bg-surface/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
                <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet/15 blur-3xl" />
                <div className="relative flex items-center justify-between gap-3 border-b border-border/70 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-primary/60 ring-offset-2 ring-offset-surface">
                      <Image src="/griot-avatar.jpg" alt="Avatar du Griot" fill sizes="48px" className="object-cover object-[50%_42%]" priority />
                    </div>
                    <div>
                      <p className="font-semibold">Le Griot</p>
                      <p className="mt-0.5 text-xs text-muted">La parole des sages, l&apos;expertise en plus.</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf/25 bg-leaf/10 px-2.5 py-1 text-[11px] font-medium text-leaf">
                    <span className="h-1.5 w-1.5 rounded-full bg-leaf" /> En ligne
                  </span>
                </div>
                <div className="relative space-y-4 py-5">
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-border/70 bg-background/80 p-4 text-sm leading-relaxed text-muted">
                    Je m&apos;appuie sur l&apos;expérience de la communauté et je cite les personnes qui ont partagé leur savoir.
                  </div>
                  <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-primary to-gold p-4 text-sm font-medium leading-relaxed text-primary-ink shadow-lg shadow-primary/10">
                    Comment contribuer à un projet open source ?
                  </div>
                  <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-violet/20 bg-violet/5 p-4 text-sm leading-relaxed">
                    Commence par repérer un sujet qui te motive, puis consulte les issues étiquetées <code className="rounded bg-violet/10 px-1.5 py-0.5 font-mono text-xs text-violet">good first issue</code>.
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted">
                      <span className="rounded-full bg-leaf/10 px-2.5 py-1 font-medium text-leaf">Source communautaire</span>
                      <span>+5 XP pour l&apos;auteur cité</span>
                    </div>
                  </div>
                </div>
                <div className="relative flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-xs text-muted">
                  <span>Une réponse nourrie par la communauté</span>
                  <span aria-hidden="true" className="text-primary">✦</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <TechMarquee />

      <section className="border-y border-border/70 bg-surface/35">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Un écosystème complet</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Cinq étapes pour faire grandir la communauté.</h2>
          </div>
          <EcosystemCarousel />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet">La boucle Baobab</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Une boucle simple. Un impact collectif.</h2>
            <p className="mt-3 text-muted">Chaque réponse validée nourrit le Griot, qui aide plus de devs et récompense ses auteurs.</p>
          </div>
          <Link href="/questions" className="w-fit text-sm font-semibold text-primary hover:underline">
            Explorer les questions <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {LOOP.map((item, index) => (
            <li
              key={item.step}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-surface/60 p-6 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 motion-reduce:transition-none"
            >
              <div aria-hidden="true" className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-gradient-to-br from-primary/10 to-violet/10 blur-2xl transition-opacity group-hover:opacity-100" />
              {index < LOOP.length - 1 && <div aria-hidden="true" className="absolute right-0 top-10 hidden h-px w-8 translate-x-1/2 bg-gradient-to-r from-primary/50 to-violet/30 xl:block" />}
              <div className="relative flex items-center justify-between">
                <span className="bg-gradient-to-r from-primary to-violet bg-clip-text font-mono text-sm font-bold text-transparent">0{index + 1}</span>
                <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/70 text-lg text-primary transition group-hover:border-primary/30 group-hover:text-gold">{item.symbol}</span>
              </div>
              <h3 className="relative mt-7 text-lg font-semibold">{item.step}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-border/70 bg-surface/35">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">La progression</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">De la Graine à la Légende.</h2>
              <p className="mt-3 max-w-2xl text-muted">Chaque contribution te fait avancer. À partir du niveau Expert, tu peux créer ton clone IA et arbitrer la Micro-Bourse.</p>
            </div>
            <Link href="/classements" className="w-fit text-sm font-semibold text-primary hover:underline">
              Voir les classements <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ol aria-label="Niveaux de progression XP" className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {LEVELS.map((level, index) => (
              <li key={level.level} className="group relative rounded-2xl border border-border/70 bg-surface/70 p-4 transition duration-200 hover:-translate-y-1 hover:border-gold/50 hover:shadow-lg hover:shadow-gold/5 motion-reduce:transition-none">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-muted">NIVEAU {String(level.level).padStart(2, "0")}</span>
                  <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-primary shadow-[0_0_12px_var(--primary)]" : "bg-border group-hover:bg-gold"}`} />
                </div>
                <p className="mt-4 font-semibold">{level.name}</p>
                <p className="mt-1 font-mono text-xs text-muted">{level.floor.toLocaleString("fr-FR")} XP</p>
                <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet transition-all duration-300 group-hover:w-full" style={{ width: `${Math.max(8, (index + 1) * 13)}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-violet/10 p-8 shadow-xl sm:p-12">
          <div aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet/15 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">À toi de jouer</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Ta prochaine contribution peut tout changer.</h2>
              <p className="mt-3 text-muted">Rejoins celles et ceux qui partagent leur savoir et construisent la suite, ensemble.</p>
            </div>
            <Link href="/login" className="shrink-0 rounded-full bg-primary px-6 py-3 font-semibold text-primary-ink shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl">
              Rejoindre Baobab Dev <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
