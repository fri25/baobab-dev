"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavItem = { href: string; label: string; hint?: string; badge?: number };
export type NavGroup = { label: string; items: NavItem[] };

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-bold text-primary-ink shadow-xs">
      {n}
    </span>
  );
}

function CategoryIcon({ label }: { label: string }) {
  switch (label.toLowerCase()) {
    case "échanger":
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-75">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
        </svg>
      );
    case "construire":
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-75">
          <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    case "gagner":
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-75">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 opacity-75">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
  }
}

/**
 * Menu de navigation desktop : dropdowns par catégorie (Échanger, Construire, Gagner)
 */
export function NavMenu({ groups }: { groups: NavGroup[] }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const activeGroup = groups.find((g) => g.items.some((i) => isActive(pathname, i.href)))?.label;
  const activeItem = groups.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));

  return (
    <div ref={ref} className="flex min-w-0 items-center">
      <nav className="flex items-center gap-1.5 text-sm" aria-label={t("Navigation principale")}>
        {groups.map((g) => {
          const current = g.label === activeGroup;
          const total = g.items.reduce((n, i) => n + (i.badge ?? 0), 0);
          const isDropdownOpen = open === g.label;
          return (
            <div key={g.label} className="relative">
              <button
                type="button"
                aria-expanded={isDropdownOpen}
                onClick={() => setOpen(isDropdownOpen ? null : g.label)}
                className={`group flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition duration-150 ${
                  current
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <CategoryIcon label={g.label} />
                <span>{g.label}</span>
                <Badge n={total} />
                <svg
                  viewBox="0 0 12 12"
                  className={`h-3 w-3 opacity-60 transition-transform duration-200 ${isDropdownOpen ? "rotate-180 opacity-100" : "group-hover:opacity-100"}`}
                  aria-hidden="true"
                >
                  <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Menu déroulant */}
              <div
                className={`absolute left-0 top-full z-40 mt-2 w-72 origin-top-left rounded-2xl border border-border/80 bg-surface/95 p-2 shadow-2xl shadow-black/15 backdrop-blur-xl transition duration-150 ${
                  isDropdownOpen ? "scale-100 opacity-100" : "pointer-events-none hidden scale-95 opacity-0"
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <span>{g.label}</span>
                  {current && <span className="text-primary font-mono text-[10px]">{t("Actif")}</span>}
                </div>
                <div className="space-y-0.5">
                  {g.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`group flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                          active
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-background hover:text-primary"
                        }`}
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                            active ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-border group-hover:bg-primary/50"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 font-medium leading-tight">
                            {item.label} <Badge n={item.badge} />
                          </span>
                          {item.hint && <span className="mt-0.5 block text-xs text-muted leading-tight">{item.hint}</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Fil d'Ariane de la page active sur très grand écran */}
        {activeItem && (
          <span className="ml-3 hidden items-center gap-2 border-l border-border/70 pl-3.5 text-xs font-medium text-foreground/80 xl:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-muted">{activeGroup} /</span>
            <span className="font-semibold text-primary">{activeItem.label}</span>
          </span>
        )}
      </nav>
    </div>
  );
}

/**
 * Menu mobile et tablette : tiroir coulissant moderne avec bouton hamburger sur la droite
 */
export function MobileNav({ groups }: { groups: NavGroup[] }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const totalBadges = groups.flatMap((g) => g.items).reduce((n, i) => n + (i.badge ?? 0), 0);

  return (
    <div ref={ref} className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        aria-label={open ? t("Fermer le menu") : t("Ouvrir le menu de navigation")}
        className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-border/80 bg-surface/80 text-foreground transition hover:border-primary/50 hover:bg-surface"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
          <path
            d={open ? "M3 3l10 10M13 3L3 13" : "M2 4h12M2 8h12M2 12h12"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {totalBadges > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-ink">
            {totalBadges}
          </span>
        )}
      </button>

      {/* Drawer Overlay Mobile */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-2xl">
          {/* En-tête du tiroir mobile */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/70 px-4">
            <span className="text-sm font-bold uppercase tracking-wider text-muted">{t("Navigation")}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("Fermer le menu")}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-foreground"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Contenu déroulant */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {groups.map((g) => (
              <div key={g.label} className="rounded-2xl border border-border/70 bg-surface/60 p-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2.5">
                  <CategoryIcon label={g.label} />
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">{g.label}</p>
                </div>
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {g.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-start gap-2.5 rounded-xl p-2.5 text-sm transition ${
                            active
                              ? "bg-primary/15 font-semibold text-primary"
                              : "text-foreground hover:bg-background"
                          }`}
                        >
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              active ? "bg-primary" : "bg-muted/40"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 font-medium">
                              {item.label} <Badge n={item.badge} />
                            </span>
                            {item.hint && <span className="block text-xs text-muted font-normal">{item.hint}</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
