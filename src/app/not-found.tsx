import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px] sm:h-[30rem] sm:w-[30rem]" />

      <section className="mx-auto grid w-full max-w-6xl items-center gap-8 sm:gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-8 lg:gap-16">
        <div className="order-2 text-center md:order-1 md:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-primary">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
            ERREUR 404
          </p>
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Cette page s&apos;est perdue en chemin.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg md:mx-0">
            Oups ! Cette page a disparu plus vite qu&apos;un bug en Pair-Debugging. Notre Griot est parti à la recherche de la bonne URL.
            <br />
            Retournez explorer nos terres.
          </p>
          <Link
            href="/"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-gold px-6 py-3 font-semibold text-primary-ink shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            RETOUR À L&apos;ACCUEIL
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        <div className="relative order-1 mx-auto w-full max-w-[25rem] sm:max-w-[31rem] md:order-2">
          <div aria-hidden="true" className="absolute inset-8 rounded-full bg-primary/10 blur-3xl" />
          <Image
            src="/404-griot.webp"
            alt="Le Griot, surpris, cherche la page introuvable parmi des symboles et des points d’interrogation."
            width={890}
            height={768}
            priority
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 496px, 496px"
            className="relative h-auto w-full drop-shadow-[0_0_28px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
          />
        </div>
      </section>
    </main>
  );
}
