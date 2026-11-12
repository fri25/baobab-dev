"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = readonly [href: string, label: string];

function NavigationLinks({
  items,
  unreadChats,
}: {
  items: readonly NavigationItem[];
  unreadChats: number;
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map(([href, label]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 transition ${
              active
                ? "bg-primary/10 font-semibold text-primary ring-1 ring-inset ring-primary/20"
                : "hover:bg-surface hover:text-foreground"
            }`}
          >
            {label}
            {href === "/discussions" && unreadChats > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-ink">{unreadChats}</span>
            )}
          </Link>
        );
      })}
    </>
  );
}

type Props = {
  items: readonly NavigationItem[];
  unreadChats: number;
  canModerate: boolean;
};

function getNavigationItems({ items, canModerate }: Props) {
  return canModerate ? [...items, ["/moderation", "Modération"] as const] : items;
}

export function DesktopNavigation(props: Props) {
  const navigationItems = getNavigationItems(props);

  return (
    <nav aria-label="Navigation principale" className="hidden gap-1 text-sm text-muted xl:flex">
      <NavigationLinks items={navigationItems} unreadChats={props.unreadChats} />
    </nav>
  );
}

export function MobileNavigation(props: Props) {
  const navigationItems = getNavigationItems(props);

  return (
    <nav aria-label="Navigation mobile" className="flex gap-2 overflow-x-auto border-t border-border px-3 py-2 text-sm text-muted xl:hidden">
      <NavigationLinks items={navigationItems} unreadChats={props.unreadChats} />
    </nav>
  );
}
