import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { GriotBubble } from "@/components/GriotBubble";
import { LiveNotifications } from "@/components/LiveNotifications";
import { Logo } from "@/components/Logo";
import { DesktopNavigation, MobileNavigation } from "@/components/PrimaryNavigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ThemePreference } from "@/lib/theme";
import { levelForXp } from "@/lib/levels";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/configured";

async function currentUser() {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [{ data: profile }, { count, error: notificationCountError }, { data: unreadChats }] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_url, xp, role").eq("id", data.user.id).single(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", data.user.id).is("read_at", null),
    supabase.rpc("unread_conversations_count"),
  ]);
  if (notificationCountError) throw new Error("Impossible de charger le nombre de notifications non lues.", { cause: notificationCountError });
  return profile ? { ...profile, unread: count ?? 0, unreadChats: (unreadChats as number | null) ?? 0 } : null;
}

const NAV: ReadonlyArray<readonly [href: string, label: string]> = [
  ["/fil", "Mon fil"],
  ["/questions", "Questions"],
  ["/griot", "Griot"],
  ["/discussions", "Discussions"],
  ["/clones", "Clones IA"],
  ["/showroom", "Showroom"],
  ["/squads", "Squads"],
  ["/bourse", "Micro-Bourse"],
  ["/radar", "Radar"],
  ["/forensic", "Forensic"],
  ["/centrale", "Centrale"],
];

export async function Header({ themePreference }: { themePreference: ThemePreference }) {
  const profile = await currentUser();
  const navigationProps = {
    items: NAV.filter(([href]) => profile || href !== "/fil"),
    unreadChats: profile?.unreadChats ?? 0,
    canModerate: Boolean(profile && ["moderator", "admin"].includes(profile.role)),
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-none items-center justify-between gap-4 px-4">
          <Link href={profile ? "/fil" : "/"} className="flex shrink-0 items-center gap-2 font-semibold">
            <Logo className="h-7 w-7" />
            <span>Baobab Dev</span>
          </Link>
          <DesktopNavigation {...navigationProps} />
          {profile ? (
            <div className="flex items-center gap-2">
              <ThemeToggle initialPreference={themePreference} />
              <LiveNotifications userId={profile.id} unread={profile.unread} />
              <Link href={`/u/${profile.username}`} className="flex items-center gap-2 text-sm">
                <Avatar user={profile} size={30} />
                <span className="hidden flex-col leading-tight sm:flex">
                  <span>@{profile.username}</span>
                  <span className="font-mono text-xs text-primary">
                    {profile.xp} XP · {levelForXp(profile.xp).name}
                  </span>
                </span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ThemeToggle initialPreference={themePreference} />
              <Link
                href="/login"
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-ink hover:opacity-90"
              >
                Se connecter
              </Link>
            </div>
          )}
        </div>
        <MobileNavigation {...navigationProps} />
      </header>
      {profile && <GriotBubble />}
    </>
  );
}
