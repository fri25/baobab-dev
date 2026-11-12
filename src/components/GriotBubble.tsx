"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { GriotChat } from "@/app/griot/GriotChat";

export function GriotBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/griot") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end sm:bottom-6 sm:right-6">
      <section
        id="griot-floating-chat"
        aria-label="Conversation avec le Griot"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`mb-3 h-[min(440px,calc(100dvh-6rem))] w-[min(340px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-surface shadow-2xl transition duration-200 ${
          isOpen ? "flex translate-y-0 opacity-100" : "hidden"
        }`}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-primary via-violet to-gold p-3 text-primary-ink">
          <div className="flex items-center gap-2.5">
            <Image
              src="/griot-avatar.jpg"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full border border-white/40 object-cover object-[50%_42%] shadow-md"
            />
            <div className="leading-tight">
              <h2 className="font-bold tracking-wide">Le Griot</h2>
              <p className="mt-1 text-[11px] text-white/80">Assistant développeur</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (draft) window.sessionStorage.setItem("griot-draft", draft);
                router.push("/griot");
              }}
              className="rounded-full px-2 text-lg text-primary-ink/75 hover:text-primary-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-ink"
              aria-label="Agrandir le chat sur la page du Griot"
              title="Agrandir"
            >
              ↗
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full px-2 text-xl text-primary-ink/75 hover:text-primary-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-ink"
              aria-label="Fermer le chat du Griot"
            >
              &times;
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
        <Link href="/griot" className="border-t border-border/70 px-3 py-2 text-xs text-primary hover:underline">
          Voir l’historique complet →
        </Link>
      </section>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="group relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        aria-label={isOpen ? "Fermer le chat du Griot" : "Ouvrir le chat du Griot"}
        aria-expanded={isOpen}
        aria-controls="griot-floating-chat"
        title={isOpen ? "Fermer le chat du Griot" : "Ouvrir le chat du Griot"}
      >
        <span
          aria-hidden="true"
          className="griot-avatar-glow absolute -inset-1 rounded-full bg-gradient-to-br from-tech via-violet to-gold opacity-75 blur-md transition duration-500 group-hover:scale-110 group-hover:opacity-100"
        />
        <span className="relative block h-14 w-14 overflow-hidden rounded-full border border-white/50 bg-[#07142c] shadow-xl ring-1 ring-[#00acf5]/40 transition-transform duration-300 group-hover:scale-105 sm:h-[4.25rem] sm:w-[4.25rem]">
          <Image
            src="/griot-avatar.jpg"
            alt=""
            fill
            sizes="(max-width: 640px) 56px, 68px"
            className="object-cover object-[50%_42%]"
          />
        </span>
        <span className="pointer-events-none absolute bottom-2 right-[calc(100%+0.75rem)] hidden whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block">
          Besoin d’aide ?
        </span>
      </button>
    </div>
  );
}
