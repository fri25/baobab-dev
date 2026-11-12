import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { GriotBubble } from "@/components/GriotBubble";
import { LiveNotifications } from "@/components/LiveNotifications";
import { Logo } from "@/components/Logo";
import { type NavGroup, NavMenu } from "@/components/NavMenu";
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

type Profile = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

// Navigation par catégories : échanger, construire, gagner sa vie
function navGroups(profile: Profile | null): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Échanger",
      items: [
        ...(profile ? [{ href: "/fil", label: "Mon fil", hint: "Ce qui te concerne aujourd'hui" }] : []),
        { href: "/questions", label: "Questions", hint: "Questions-réponses de la communauté" },
        { href: "/discussions", label: "Discussions", hint: "Messages privés et sujets", badge: profile?.unreadChats },
        { href: "/griot", label: "Le Griot", hint: "L'IA qui cite la communauté" },
        { href: "/classements", label: "Classements", hint: "Par ville, pays, continent" },
      ],
    },
    {
      label: "Construire",
      items: [
        { href: "/showroom", label: "Showroom", hint: "Projets africains et appels à collaborateurs" },
        { href: "/squads", label: "Squads", hint: "Équipes formées par compétences" },
        { href: "/defis", label: "Défis", hint: "Le défi de la semaine" },
        { href: "/debug", label: "Pair-Debugging", hint: "Déboguer à plusieurs, en direct" },
        { href: "/stack", label: "Stack Afrique", hint: "Outils et API africains" },
        { href: "/activite", label: "GitHub vivant", hint: "Activité et issues" },
      ],
    },
    {
      label: "Gagner",
      items: [
        { href: "/bourse", label: "Micro-Bourse", hint: "Bugs et fonctionnalités payés" },
        { href: "/radar", label: "Radar d'opportunités", hint: "Appels d'offres validés" },
        { href: "/forensic", label: "Code Forensic", hint: "Audits de code rémunérés" },
        { href: "/centrale", label: "Centrale d'achat", hint: "Infrastructures au prix de gros" },
        { href: "/clones", label: "Clones IA", hint: "Assistants des seniors" },
        { href: "/recruteurs", label: "Espace recruteurs", hint: "Profils vérifiés" },
        ...(profile
          ? [
              { href: "/propositions", label: "Mes propositions", hint: "Offres reçues des recruteurs" },
              { href: "/portefeuille", label: "Portefeuille", hint: "Solde et transactions" },
            ]
          : []),
      ],
    },
  ];
  if (profile && ["moderator", "admin"].includes(profile.role)) {
    groups.push({
      label: "Administration",
      items: [{ href: "/moderation", label: "Modération", hint: "Signalements, validations du Radar" }],
    });
  }
  return groups;
}

export async function Header() {
  const profile = await currentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href={profile ? "/fil" : "/"} className="flex shrink-0 items-center gap-2 font-semibold">
          <Logo className="h-7 w-7" />
          <span className="hidden sm:inline">Baobab Dev</span>
        </Link>
        <NavMenu groups={navGroups(profile)} />
        {profile ? (
          <div className="flex shrink-0 items-center gap-2">
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
            className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-ink hover:opacity-90"
          >
            Se connecter
          </Link>
        )}
      </div>
      <GriotBubble unreadChats={profile?.unreadChats ?? 0} signedIn={Boolean(profile)} />
    </header>
  );
}
