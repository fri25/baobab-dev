"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";

const STEPS = [
  {
    title: "Se rencontrer",
    description: "Profil pré-rempli depuis GitHub, matching par compétences, classements par ville et par pays.",
    image: "/ecosystem-01.webp",
    alt: "Profils de développeurs reliés par un réseau lumineux",
    link: "Explorer la communauté",
    href: "/classements",
  },
  {
    title: "Échanger",
    description: "Questions-réponses, le Griot sur l'app et WhatsApp, Pair-Debugging à moins de 5 Ko/s.",
    image: "/ecosystem-02.webp",
    alt: "Bulles de conversation lumineuses autour d'un échange de code",
    link: "Poser une question",
    href: "/questions",
  },
  {
    title: "Partager",
    description: "Le Showroom des projets africains, ton activité GitHub en direct, la Stack Afrique vérifiée.",
    image: "/ecosystem-03.webp",
    alt: "Projet de code représenté dans un cube lumineux",
    link: "Visiter le Showroom",
    href: "/showroom",
  },
  {
    title: "Collaborer",
    description: "Des Squads formées par compétences, du débogage à plusieurs, des audits entre pairs.",
    image: "/ecosystem-04.webp",
    alt: "Équipe qui construit ensemble des formes lumineuses",
    link: "Découvrir les Squads",
    href: "/squads",
  },
  {
    title: "Gagner",
    description: "Primes de la Micro-Bourse, clone IA, missions. Versements en Mobile Money, Wave ou Orange Money.",
    image: "/ecosystem-05.webp",
    alt: "Badge XP lumineux symbolisant les récompenses et la progression",
    link: "Voir la Micro-Bourse",
    href: "/bourse",
  },
];

const SLIDE_DURATION = 5500;

export function EcosystemCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef<number | null>(null);
  const paused = hovered || focused || hidden;

  const move = useCallback((step: 1 | -1) => {
    setDirection(step);
    setActiveIndex((index) => (index + step + STEPS.length) % STEPS.length);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || document.hidden) return;
    const timer = window.setInterval(() => move(1), SLIDE_DURATION);
    return () => window.clearInterval(timer);
  }, [move, paused, reducedMotion]);

  useEffect(() => {
    const pauseWhenHidden = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStart.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 48) move(distance < 0 ? 1 : -1);
    touchStart.current = null;
  }

  return (
    <div
      className="mt-9"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0].clientX;
      }}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
    >
      <div
        className="relative mx-auto h-[31rem] max-w-5xl overflow-hidden perspective-[1600px] sm:h-[35rem]"
        role="region"
        aria-roledescription="carrousel"
        aria-label="Les cinq étapes de l’écosystème Baobab Dev"
      >
        {STEPS.map((step, index) => {
          const offset = (index - activeIndex + STEPS.length) % STEPS.length;
          const position = offset > Math.floor(STEPS.length / 2) ? offset - STEPS.length : offset;
          const isActive = position === 0;
          return (
            <article
              key={step.title}
              aria-roledescription="diapositive"
              aria-label={`${index + 1} sur ${STEPS.length} : ${step.title}`}
              aria-hidden={!isActive}
              className={`ecosystem-slide absolute left-1/2 top-1/2 w-[min(88%,42rem)] ${
                isActive ? "z-10" : "pointer-events-none"
              }`}
              data-direction={direction}
              data-active={isActive}
              style={{
                transform: `translate(calc(-50% + ${position * 91}%), -50%) scale(${isActive ? 1 : 0.9}) rotateY(${position === 0 ? 0 : position * 8}deg)`,
                opacity: isActive ? 1 : Math.abs(position) === 1 ? 0.34 : 0,
                zIndex: isActive ? 10 : 5 - Math.abs(position),
                transition: reducedMotion ? "none" : "transform 550ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease",
              }}
            >
              <div className="group relative overflow-hidden rounded-3xl border border-border/80 bg-surface/75 shadow-2xl shadow-black/20 backdrop-blur-xl transition-colors duration-300 hover:border-primary/50 motion-reduce:transition-none">
                <div aria-hidden="true" className="pointer-events-none absolute -left-16 top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
                <div aria-hidden="true" className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-violet/15 blur-3xl" />
                <div className="relative flex h-52 items-center justify-center overflow-hidden border-b border-border/70 bg-gradient-to-br from-background via-surface to-background sm:h-64">
                  <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--violet)_12%,transparent),transparent_65%)]" />
                  <Image
                    src={step.image}
                    alt={step.alt}
                    fill
                    sizes="(max-width: 640px) 88vw, 672px"
                    className="object-contain p-2 transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none"
                    priority={index === 0}
                  />
                  <span className="absolute left-4 top-4 rounded-full border border-border/70 bg-background/75 px-3 py-1 font-mono text-xs font-semibold text-primary backdrop-blur">
                    ÉTAPE {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="relative p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{step.title}</h3>
                      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{step.description}</p>
                    </div>
                    <span aria-hidden="true" className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-lg text-primary sm:grid">
                      ✦
                    </span>
                  </div>
                  <Link href={step.href} tabIndex={isActive ? 0 : -1} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted hover:text-primary">
                    {step.link} <span aria-hidden="true" className="text-primary">→</span>
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mx-auto mt-5 flex max-w-5xl items-center justify-between gap-4 px-2">
        <button
          type="button"
          onClick={() => move(-1)}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface/70 px-4 text-sm font-medium transition hover:border-primary/50 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Étape précédente"
        >
          <span aria-hidden="true">←</span><span className="hidden sm:inline">Précédent</span>
        </button>
        <div className="flex items-center gap-2" role="group" aria-label="Choisir une étape">
          {STEPS.map((step, index) => (
            <button
              key={step.title}
              type="button"
              onClick={() => {
                setDirection(index >= activeIndex ? 1 : -1);
                setActiveIndex(index);
              }}
              aria-label={`Afficher l’étape ${index + 1} : ${step.title}`}
              aria-current={index === activeIndex ? "step" : undefined}
              className={`h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                index === activeIndex ? "w-8 bg-primary shadow-[0_0_14px_color-mix(in_srgb,var(--primary)_55%,transparent)]" : "w-2.5 bg-border hover:bg-muted"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface/70 px-4 text-sm font-medium transition hover:border-primary/50 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Étape suivante"
        >
          <span className="hidden sm:inline">Suivant</span><span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="sr-only" aria-live={paused ? "polite" : "off"} aria-atomic="true">
        Étape {activeIndex + 1} sur {STEPS.length} : {STEPS[activeIndex].title}
      </p>
    </div>
  );
}
