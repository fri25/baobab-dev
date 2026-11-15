import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";
import { GriotBubble } from "@/components/GriotBubble";
import { LiveNotifications } from "@/components/LiveNotifications";
import { Logo } from "@/components/Logo";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/NavMenu";
import { SearchBox } from "@/components/SearchBox";
import { HeaderCenter } from "@/components/SidebarNav";
import { currentUser, navGroups } from "@/lib/nav";
import { levelForXp } from "@/lib/levels";

export async function Header() {
  const t = await getT();
  const profile = await currentUser();
  const groups = navGroups(profile, t);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          {/* Logo : aligné sur la barre latérale */}
          <Link href={profile ? "/fil" : "/"} className="flex shrink-0 items-center gap-2.5 lg:w-[13.25rem]">
            <Logo className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="leading-tight">
              <span className="block text-base font-extrabold uppercase tracking-wide">
                Baobab <span className="text-brand">Dev</span>
              </span>
              <span className="hidden text-[11px] text-muted sm:block">{t("Écosystème dev panafricain")}</span>
            </span>
          </Link>

          <HeaderCenter groups={groups} search={<SearchBox />} />

          {/* Actions à droite */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {profile && (
              <Link
                href="/questions/new"
                className="hidden items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:border-primary/50 hover:text-primary xl:inline-flex"
              >
                <span aria-hidden="true" className="text-primary">+</span>
                {t("Poser une question")}
              </Link>
            )}
            <LanguageSwitch />
            <ThemeToggle compact />

            {profile ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <LiveNotifications userId={profile.id} unread={profile.unread} />
                <ProfileMenu user={profile} levelName={levelForXp(profile.xp).name} />
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-ink transition hover:opacity-90 sm:px-4 sm:text-sm"
              >
                {t("Connexion")} <span aria-hidden="true">→</span>
              </Link>
            )}

            {/* Menu mobile / tablette */}
            <MobileNav groups={groups} />
          </div>
        </div>
      </header>

      {/* Bulle flottante du Griot */}
      {profile && <GriotBubble />}
    </>
  );
}
