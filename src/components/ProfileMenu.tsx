"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";

type Props = {
  user: { username: string; full_name: string | null; avatar_url: string | null; xp: number };
  levelName: string;
};

const itemClass =
  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground/90 transition hover:bg-background hover:text-primary";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Menu du compte : clic sur l'avatar → profil, paramètres, photo, déconnexion.
export function ProfileMenu({ user, levelName }: Props) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("Menu du compte")}
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-2 rounded-full border border-border/70 bg-surface/70 py-1 pl-1 pr-2.5 text-sm transition duration-150 hover:border-primary/50 hover:bg-surface"
      >
        <Avatar user={user} size={28} />
        <span className="hidden flex-col text-left leading-tight sm:flex">
          <span className="font-semibold text-xs text-foreground">@{user.username}</span>
          <span className="font-mono text-[10px] text-primary font-medium">
            {user.xp}{" "}{t("XP")}
          </span>
        </span>
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 text-muted transition-transform duration-200 ${open ? "rotate-180 text-foreground" : "group-hover:text-foreground"}`}
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        role="menu"
        className={`absolute right-0 top-full z-40 mt-2 w-64 origin-top-right rounded-2xl border border-border/80 bg-surface/95 p-2 shadow-2xl shadow-black/15 backdrop-blur-xl transition duration-150 ${
          open ? "scale-100 opacity-100" : "pointer-events-none hidden scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 rounded-xl bg-background/60 p-2.5">
          <Avatar user={user} size={38} />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold text-sm">{user.full_name ?? user.username}</p>
            <p className="truncate text-xs text-muted">@{user.username}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {user.xp}{" "}{t("XP ·")}{" "}{levelName}
            </span>
          </div>
        </div>

        <div className="my-1.5 border-t border-border/60" />

        <div className="space-y-0.5">
          <Link role="menuitem" href={`/u/${user.username}`} className={itemClass}>
            <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" />
            {t("Mon profil")}
          </Link>
          <Link role="menuitem" href="/parametres#photo" className={itemClass}>
            <Icon d="M4 8h3l2-3h6l2 3h3v11H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            {t("Changer ma photo")}
          </Link>
          <Link role="menuitem" href="/parametres" className={itemClass}>
            <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            {t("Paramètres")}
          </Link>
        </div>

        <div className="my-1.5 border-t border-border/60" />

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            role="menuitem"
            className={`${itemClass} w-full text-red-500 hover:bg-red-500/10 hover:text-red-600`}
          >
            <Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            {t("Se déconnecter")}
          </button>
        </form>
      </div>
    </div>
  );
}
