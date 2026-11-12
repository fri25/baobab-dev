"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavItem = { href: string; label: string; hint?: string; badge?: number };
export type NavGroup = { label: string; items: NavItem[] };

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-ink">{n}</span>;
}

// Navigation par catégories : l'onglet en cours et sa catégorie sont mis en évidence.
export function NavMenu({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Ferme les menus quand on change de page, clique ailleurs ou appuie sur Échap
  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobile(false);
      }
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
    <div ref={ref} className="flex min-w-0 flex-1 items-center">
      {/* Bureau : une entrée par catégorie, menu déroulant */}
      <nav className="hidden items-center gap-1 text-sm lg:flex" aria-label="Navigation principale">
        {groups.map((g) => {
          const current = g.label === activeGroup;
          const total = g.items.reduce((n, i) => n + (i.badge ?? 0), 0);
          return (
            <div key={g.label} className="relative">
              <button
                type="button"
                aria-expanded={open === g.label}
                onClick={() => setOpen(open === g.label ? null : g.label)}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
                  current ? "bg-primary/10 font-semibold text-primary" : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {g.label}
                <Badge n={total} />
                <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${open === g.label ? "rotate-180" : ""}`} aria-hidden="true">
                  <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              {/* Toujours rendu (liens lisibles sans JavaScript et par les moteurs), affiché à l'ouverture */}
              {(
                <div className={`absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-border bg-surface p-1.5 shadow-lg ${open === g.label ? "" : "hidden"}`}>
                  {g.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
                          active ? "bg-primary/10 text-primary" : "hover:bg-background"
                        }`}
                      >
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            {item.label} <Badge n={item.badge} />
                          </span>
                          {item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {activeItem && (
          <span className="ml-2 hidden items-center gap-1.5 border-l border-border pl-3 text-sm font-semibold text-foreground xl:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {activeItem.label}
          </span>
        )}
      </nav>

      {/* Mobile : page en cours + bouton Menu, panneau par catégories */}
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <button
          type="button"
          aria-expanded={mobile}
          onClick={() => setMobile(!mobile)}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path d={mobile ? "M3 3l10 10M13 3L3 13" : "M2 4h12M2 8h12M2 12h12"} stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Menu
          <Badge n={groups.flatMap((g) => g.items).reduce((n, i) => n + (i.badge ?? 0), 0)} />
        </button>
        {activeItem && <span className="truncate text-sm font-semibold text-primary">{activeItem.label}</span>}
      </div>
      {(
        <div className={`absolute inset-x-0 top-full z-30 max-h-[75vh] overflow-y-auto border-b border-border bg-background px-4 py-4 shadow-lg lg:hidden ${mobile ? "" : "hidden"}`}>
          <div className="grid gap-5 sm:grid-cols-3">
            {groups.map((g) => (
              <div key={g.label}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${g.label === activeGroup ? "text-primary" : "text-muted"}`}>{g.label}</p>
                <ul className="mt-2 space-y-0.5">
                  {g.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                            active ? "border-l-2 border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-surface"
                          }`}
                        >
                          {item.label} <Badge n={item.badge} />
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
