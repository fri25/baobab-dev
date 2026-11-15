"use client";

import { useT } from "@/lib/i18n/client";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { GriotChat } from "@/app/griot/GriotChat";

export function GriotBubble() {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/griot") return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end sm:bottom-6 sm:right-6">
      {/* Fenêtre de chat flottante */}
      <section
        id="griot-floating-chat"
        aria-label={t("Conversation rapide avec le Griot")}
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`mb-3 h-[min(500px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-border/80 bg-surface shadow-2xl shadow-black/30 backdrop-blur-2xl transition duration-200 ${
          isOpen ? "flex translate-y-0 opacity-100 scale-100" : "hidden opacity-0 scale-95"
        }`}
      >
        {/* Header chat */}
        <div className="flex items-center justify-between border-b border-border/50 bg-primary px-4 py-3 text-primary-ink">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-white/40">
              <Image
                src="/griot-avatar.jpg"
                alt={t("Avatar du Griot")}
                fill
                sizes="36px"
                className="object-cover object-[50%_42%]"
              />
            </div>
            <div className="leading-tight">
              <h2 className="text-sm font-bold tracking-wide">{t("Le Griot")}</h2>
              <p className="flex items-center gap-1 text-[10px] text-white/80">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {t("IA communautaire sourcée")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                if (draft) window.sessionStorage.setItem("griot-draft", draft);
                router.push("/griot");
              }}
              className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label={t("Agrandir le chat sur la page du Griot")}
              title={t("Plein écran")}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3.5zm13 0h-3.5a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-4a.5.5 0 0 0-.5-.5zm-13 13h3.5a.5.5 0 0 0 0-1h-3v-3a.5.5 0 0 0-1 0v4a.5.5 0 0 0 .5.5zm13 0a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label={t("Fermer le chat du Griot")}
              title={t("Fermer")}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
              </svg>
            </button>
          </div>
        </div>

        <GriotChat
          history={[]}
          historyHasMore={false}
          historyUnavailable={false}
          presentation="bubble"
          onDraftChange={setDraft}
        />

        <div className="flex items-center justify-between border-t border-border/60 bg-surface/80 px-4 py-2 text-xs backdrop-blur">
          <span className="flex items-center gap-1.5 text-muted">
            <svg viewBox="0 0 16 16" className="h-3 w-3 text-leaf" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
            {t("Citations récompensées (+5 XP)")}
          </span>
          <Link href="/griot" className="font-bold text-primary hover:underline">
            {t("Historique complet →")}
          </Link>
        </div>
      </section>

      {/* Bouton d'ouverture circulaire */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="group relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        aria-label={isOpen ? t("Fermer le chat du Griot") : t("Ouvrir le chat du Griot")}
        aria-expanded={isOpen}
        aria-controls="griot-floating-chat"
        title={isOpen ? t("Fermer le Griot") : t("Demander au Griot")}
      >
        <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white/50 bg-surface shadow-2xl transition duration-300 group-hover:scale-105 sm:h-16 sm:w-16">
          <Image
            src="/griot-avatar.jpg"
            alt={t("Le Griot")}
            fill
            sizes="(max-width: 640px) 56px, 64px"
            className="object-cover object-[50%_42%]"
          />
        </span>
        {/* Notification dot */}
        <span className="absolute -top-0.5 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-leaf shadow-sm" aria-hidden="true" />
      </button>
    </div>
  );
}
