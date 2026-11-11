"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { GriotChat } from "@/app/griot/GriotChat";

export function GriotBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/griot") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <section
        id="griot-floating-chat"
        aria-label="Conversation avec le Griot"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`mb-3 h-[min(440px,calc(100dvh-6rem))] w-[min(340px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-surface shadow-2xl transition duration-200 ${
          isOpen ? "flex translate-y-0 opacity-100" : "hidden"
        }`}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 to-purple-800 p-4 text-white">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">📜</span>
            <h2 className="font-bold tracking-wide">Le Griot</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-full px-2 text-xl text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Fermer le chat du Griot"
          >
            &times;
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <GriotChat history={[]} historyHasMore={false} historyUnavailable={false} />
          <Link href="/griot" className="mt-4 inline-block text-sm text-primary hover:underline">
            Voir l’historique complet →
          </Link>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="group relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        aria-label={isOpen ? "Fermer le chat du Griot" : "Ouvrir le chat du Griot"}
        aria-expanded={isOpen}
        aria-controls="griot-floating-chat"
      >
        <span
          aria-hidden="true"
          className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-500 via-purple-600 to-pink-500 opacity-75 blur-md transition duration-500 group-hover:scale-110 group-hover:opacity-100 motion-reduce:animate-none animate-pulse"
        />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-slate-900 text-2xl text-white shadow-xl transition-transform duration-300 group-hover:scale-105">
          <span aria-hidden="true">🗣️</span>
        </span>
      </button>
    </div>
  );
}
