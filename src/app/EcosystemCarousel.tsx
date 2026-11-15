"use client";

import { useT } from "@/lib/i18n/client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";

const STEPS = [
  {
    title: "Se rencontrer",
    subtitle: "Réseau et identité professionnelle",
    description: "Profil pré-rempli depuis GitHub, matching intelligent par compétences, et classements par ville, pays et continent.",
    image: "/ecosystem-01.webp",
    alt: "Profils de développeurs reliés par un réseau lumineux",
    link: "Explorer la communauté",
    href: "/classements",
    tag: "Identité",
  },
  {
    title: "Échanger",
    subtitle: "Questions & Réponses + IA",
    description: "Questions techniques précises, le Griot sur le Web et WhatsApp qui cite la communauté, et Pair-Debugging optimisé à moins de 5 Ko/s.",
    image: "/ecosystem-02.webp",
    alt: "Bulles de conversation lumineuses autour d'un échange de code",
    link: "Poser une question",
    href: "/questions",
    tag: "Savoir",
  },
  {
    title: "Partager",
    subtitle: "Visibilité & Vitrine panafricaine",
    description: "Le Showroom des projets africains, activité GitHub synchronisée, et catalogue de la Stack Afrique vérifiée en production.",
    image: "/ecosystem-03.webp",
    alt: "Projet de code représenté dans un cube lumineux",
    link: "Visiter le Showroom",
    href: "/showroom",
    tag: "Projets",
  },
  {
    title: "Collaborer",
    subtitle: "Squads & Entraide technique",
    description: "Des Squads formées par affinités et compétences, sessions de débogage partagées et audits de dette technique avec Code Forensic.",
    image: "/ecosystem-04.webp",
    alt: "Équipe qui construit ensemble des formes lumineuses",
    link: "Découvrir les Squads",
    href: "/squads",
    tag: "Équipes",
  },
  {
    title: "Gagner",
    subtitle: "Rémunération & Mobile Money",
    description: "Primes de la Micro-Bourse au résultat vérifié, monétisation de son clone IA senior, et versements directs par Wave ou Orange Money.",
    image: "/ecosystem-05.webp",
    alt: "Badge XP lumineux symbolisant les récompenses et la progression",
    link: "Voir la Micro-Bourse",
    href: "/bourse",
    tag: "Revenus",
  },
];

const SLIDE_DURATION = 6000;

export function EcosystemCarousel() {
  const t = useT();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef<number | null>(null);
  const paused = hovered || focused || hidden;

  const move = useCallback((step: 1 | -1) => {
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
    if (Math.abs(distance) > 40) move(distance < 0 ? 1 : -1);
    touchStart.current = null;
  }

  const current = STEPS[activeIndex];

  return (
    <div
      className="mt-8"
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
      {/* Sélecteur d'onglets / étapes */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
        {STEPS.map((step, idx) => {
          const isSelected = idx === activeIndex;
          return (
            <button
              key={step.title}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`group flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                isSelected
                  ? "bg-primary text-primary-ink shadow-md shadow-primary/25"
                  : "border border-border/80 bg-surface/70 text-muted hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <span className={`font-mono text-[11px] ${isSelected ? "text-primary-ink/90 font-bold" : "text-primary"}`}>
                0{idx + 1}
              </span>
              <span>{step.title}</span>
            </button>
          );
        })}
      </div>

      {/* Carte active en vedette (présentation moderne sans troncature latérale) */}
      <div className="mx-auto max-w-4xl">
        <article
          key={current.title}
          aria-roledescription="diapositive"
          aria-label={`${activeIndex + 1} sur ${STEPS.length} : ${current.title}`}
          className="group relative overflow-hidden rounded-3xl border border-border/80 bg-surface/90 transition duration-300 hover:border-primary/50"
        >
          {/* Cercles de diffusion lumineuse */}

          <div className="grid md:grid-cols-2 items-center">
            {/* Zone visuelle */}
            <div className="relative flex h-64 sm:h-72 md:h-96 items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-border/70 bg-background p-6">
              
              <div className="relative h-full w-full max-w-xs transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none">
                <Image
                  src={current.image}
                  alt={current.alt}
                  fill
                  sizes="(max-width: 768px) 90vw, 384px"
                  className="object-contain p-2"
                  priority
                />
              </div>

              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-primary backdrop-blur">
                  {t("ÉTAPE 0")}{activeIndex + 1}
                </span>
                <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur">
                  {current.tag}
                </span>
              </div>
            </div>

            {/* Contenu textuel & actions */}
            <div className="relative flex flex-col justify-between p-6 sm:p-8 md:min-h-96">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {current.subtitle}
                </p>
                <h3 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
                  {current.title}
                </h3>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted">
                  {current.description}
                </p>

                <div className="mt-6">
                  <Link
                    href={current.href}
                    className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/25 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-ink hover:shadow-lg hover:shadow-primary/20"
                  >
                    <span>{current.link}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>

              {/* Contrôles du carrousel en bas de carte */}
              <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-4">
                {/* Flèches Précédent / Suivant */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => move(-1)}
                    aria-label={t("Étape précédente")}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted transition hover:border-primary/50 hover:bg-surface hover:text-foreground"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(1)}
                    aria-label={t("Étape suivante")}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-background/80 text-muted transition hover:border-primary/50 hover:bg-surface hover:text-foreground"
                  >
                    →
                  </button>
                </div>

                {/* Indicateurs de progression (dots) */}
                <div className="flex items-center gap-1.5">
                  {STEPS.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      aria-label={`Aller à l'étape ${idx + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === activeIndex
                          ? "w-6 bg-primary"
                          : "w-2 bg-border hover:bg-muted"
                      }`}
                    />
                  ))}
                </div>

                <span className="font-mono text-xs text-muted">
                  0{activeIndex + 1} / 0{STEPS.length}
                </span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
