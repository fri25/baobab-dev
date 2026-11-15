"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavMenu, type NavGroup } from "@/components/NavMenu";
import { useT } from "@/lib/i18n/client";

export type SidebarSquad = { id: string; name: string; members: number };

// Pages sans barre latérale : accueil public, connexion, hors ligne
const HIDDEN_ON = ["/", "/login", "/offline"];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// Icônes au trait (24×24), une par rubrique
const ICONS: Record<string, string> = {
  "/fil": "M4 6h16M4 12h16M4 18h10",
  "/questions": "M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.1-1.3 2v.3M12 17.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  "/discussions": "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  "/griot": "M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z",
  "/classements": "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3",
  "/showroom": "M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4",
  "/squads": "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  "/defis": "M6 4h12M9 4v4l-4 8a3 3 0 0 0 2.7 4h8.6a3 3 0 0 0 2.7-4l-4-8V4",
  "/debug": "M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 5l-3 14",
  "/stack": "M12 2l9 5v10l-9 5-9-5V7l9-5zM12 22V12M21 7l-9 5-9-5",
  "/activite": "M3 12h4l3-8 4 16 3-8h4",
  "/bourse": "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  "/radar": "M12 12l6-6M21 12a9 9 0 1 1-9-9M16.5 12a4.5 4.5 0 1 1-4.5-4.5",
  "/forensic": "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11l2 2 4-4",
  "/centrale": "M3 9l1.5-5h15L21 9M3 9h18v11H3V9zM9 20v-6h6v6",
  "/clones": "M12 8V4H8M4 12h16v8H4v-8zM9 16h.01M15 16h.01M12 4h.01",
  "/recruteurs": "M20 7H4v13h16V7zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",
  "/propositions": "M4 4h16v12H5.2L4 17.2V4zM8 9h8M8 12h5",
  "/portefeuille": "M3 7h18v13H3V7zM16 13h2M3 7l3-4h12l3 4",
  "/moderation": "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
};

function Icon({ href }: { href: string }) {
  const d = ICONS[href];
  if (!d) return <span aria-hidden="true" className="mx-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-50" />;
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const SQUAD_DOTS = ["bg-primary", "bg-tech", "bg-gold", "bg-violet"];

export function SidebarNav({ groups, squads }: { groups: NavGroup[]; squads: SidebarSquad[] }) {
  const t = useT();
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border px-3 py-5 lg:block">
      <nav aria-label={t("Navigation principale")} className="space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">{group.label}</p>
            <ul className="mt-2 space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.hint}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                        active
                          ? "border-primary/40 bg-primary/10 font-semibold text-primary"
                          : "border-transparent text-muted hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      <Icon href={item.href} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-md bg-primary px-1.5 font-mono text-[10px] font-bold text-primary-ink">{item.badge}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {squads.length > 0 && (
          <div className="border-t border-border pt-5">
            <p className="px-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">{t("Mes Squads")}</p>
            <ul className="mt-2 space-y-0.5">
              {squads.map((squad, i) => (
                <li key={squad.id}>
                  <Link
                    href={`/squads/${squad.id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-surface hover:text-foreground"
                  >
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${SQUAD_DOTS[i % SQUAD_DOTS.length]}`} />
                    <span className="min-w-0 flex-1 truncate">{squad.name}</span>
                    <span className="font-mono text-[11px]">{squad.members}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </aside>
  );
}

// Centre de l'en-tête : la recherche dans l'application, les menus déroulants sur les pages sans barre latérale
export function HeaderCenter({ groups, search }: { groups: NavGroup[]; search: React.ReactNode }) {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) {
    return (
      <div className="hidden flex-1 justify-center lg:flex">
        <NavMenu groups={groups} />
      </div>
    );
  }
  return <div className="hidden min-w-0 flex-1 md:flex">{search}</div>;
}
