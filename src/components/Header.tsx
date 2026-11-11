import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { GriotBubble } from "@/components/GriotBubble";
import { LiveNotifications } from "@/components/LiveNotifications";
import { Logo } from "@/components/Logo";
import { levelForXp } from "@/lib/levels";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/configured";

async function currentUser() {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [{ data: profile }, { count }, { data: unreadChats }] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_url, xp, role").eq("id", data.user.id).single(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", data.user.id).is("read_at", null),
    supabase.rpc("unread_conversations_count"),
  ]);
  return profile ? { ...profile, unread: count ?? 0, unreadChats: (unreadChats as number | null) ?? 0 } : null;
}

const NAV = [
  ["/fil", "Mon fil"],
  ["/questions", "Questions"],
  ["/discussions", "Discussions"],
  ["/clones", "Clones IA"],
  ["/showroom", "Showroom"],
  ["/squads", "Squads"],
  ["/bourse", "Micro-Bourse"],
  ["/radar", "Radar"],
  ["/forensic", "Forensic"],
  ["/centrale", "Centrale"],
];

export async function Header() {
  const profile = await currentUser();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href={profile ? "/fil" : "/"} className="flex shrink-0 items-center gap-2 font-semibold">
            <Logo className="h-7 w-7" />
            <span>Baobab Dev</span>
          </Link>
          <nav className="hidden gap-3 text-sm text-muted xl:flex">
            {NAV.filter(([href]) => profile || href !== "/fil").map(([href, label]) => (
              <Link key={href} href={href} className="flex items-center gap-1 hover:text-foreground">
                {label}
                {href === "/discussions" && profile && profile.unreadChats > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-ink">{profile.unreadChats}</span>
                )}
              </Link>
            ))}
            {profile && ["moderator", "admin"].includes(profile.role) && (
              <Link href="/moderation" className="hover:text-foreground">
                Modération
              </Link>
            )}
          </nav>
          {profile ? (
            <div className="flex items-center gap-2">
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
            <Link
              href="/login"
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-ink hover:opacity-90"
            >
              Se connecter
            </Link>
          )}
        </div>
        {/* Navigation mobile, défilante (utilisable dès 360 px) */}
        <nav className="flex gap-4 overflow-x-auto border-t border-border px-4 py-2 text-sm text-muted xl:hidden">
          {NAV.filter(([href]) => profile || href !== "/fil").map(([href, label]) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-1 hover:text-foreground">
              {label}
              {href === "/discussions" && profile && profile.unreadChats > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-ink">{profile.unreadChats}</span>
              )}
            </Link>
          ))}
        </nav>
      </header>
      {profile && <GriotBubble />}
    </>
  );
}
