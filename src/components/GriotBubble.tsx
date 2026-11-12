"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Bulle flottante : poser une question au Griot depuis n'importe quelle page, et accéder aux messages privés.
export function GriotBubble({ unreadChats, signedIn }: { unreadChats: number; signedIn: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");

  useEffect(() => setOpen(false), [pathname]);

  // Inutile sur les pages qui font déjà ce travail, ou pendant une conversation
  if (pathname.startsWith("/griot") || pathname.startsWith("/login") || /^\/discussions\/[^/]+$/.test(pathname) || pathname.startsWith("/debug/")) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 shadow-xl">
          <p className="font-semibold">Le Griot</p>
          <p className="text-xs text-muted">Réponses tirées des réponses validées de la communauté, toujours sourcées.</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const q = question.trim();
              router.push(q ? `/griot?q=${encodeURIComponent(q)}` : "/griot");
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pose ta question…"
              aria-label="Question pour le Griot"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              autoFocus
            />
            <button className="rounded-lg bg-primary px-3 text-sm font-medium text-primary-ink">Demander</button>
          </form>
          <div className="mt-3 border-t border-border pt-3 text-sm">
            {signedIn ? (
              <Link href="/discussions" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-background">
                <span>Mes discussions privées</span>
                {unreadChats > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-primary-ink">{unreadChats}</span>
                ) : (
                  <span className="text-muted">→</span>
                )}
              </Link>
            ) : (
              <Link href="/login" className="block rounded-lg px-2 py-1.5 text-primary hover:bg-background">
                Connecte-toi pour discuter avec les devs →
              </Link>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Fermer le Griot" : "Ouvrir le Griot et les discussions"}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-ink shadow-lg transition-transform hover:scale-105"
      >
        {open ? (
          <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
          </svg>
        ) : (
          // Le Griot : silhouette du conteur et sa bulle de parole
          <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
            <path d="M5 7a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3h-9l-6 5v-5H8a3 3 0 0 1-3-3z" fill="currentColor" opacity="0.25" />
            <circle cx="16" cy="10" r="3" fill="currentColor" />
            <path d="M10.5 18c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {!open && unreadChats > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-leaf px-1 text-[11px] font-bold text-background">
            {unreadChats}
          </span>
        )}
      </button>
    </div>
  );
}
