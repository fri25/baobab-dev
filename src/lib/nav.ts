import "server-only";
import { cache } from "react";
import type { NavGroup } from "@/components/NavMenu";
import type { T } from "@/lib/i18n/shared";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/configured";

// Utilisateur courant (une seule série de requêtes par page, partagée par l'en-tête et la barre latérale)
export const currentUser = cache(async () => {
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
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

// Navigation par catégories : échanger, construire, gagner sa vie
export function navGroups(profile: CurrentUser | null, t: T): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: t("Échanger"),
      items: [
        ...(profile ? [{ href: "/fil", label: t("Mon fil"), hint: t("Ce qui te concerne aujourd'hui") }] : []),
        { href: "/questions", label: t("Questions"), hint: t("Questions-réponses de la communauté") },
        { href: "/discussions", label: t("Discussions"), hint: t("Messages privés et sujets"), badge: profile?.unreadChats },
        { href: "/griot", label: t("Le Griot"), hint: t("L'IA qui cite la communauté") },
        { href: "/classements", label: t("Classements"), hint: t("Par ville, pays, continent") },
      ],
    },
    {
      label: t("Construire"),
      items: [
        { href: "/showroom", label: t("Showroom"), hint: t("Projets africains et appels à collaborateurs") },
        { href: "/squads", label: t("Squads"), hint: t("Équipes formées par compétences") },
        { href: "/defis", label: t("Défis"), hint: t("Le défi de la semaine") },
        { href: "/debug", label: t("Pair-Debugging"), hint: t("Déboguer à plusieurs, en direct") },
        { href: "/stack", label: t("Stack Afrique"), hint: t("Outils et API africains") },
        { href: "/activite", label: t("GitHub vivant"), hint: t("Activité et issues") },
      ],
    },
    {
      label: t("Gagner"),
      items: [
        { href: "/bourse", label: t("Micro-Bourse"), hint: t("Bugs et fonctionnalités payés") },
        { href: "/radar", label: t("Radar d'opportunités"), hint: t("Appels d'offres validés") },
        { href: "/forensic", label: t("Code Forensic"), hint: t("Audits de code rémunérés") },
        { href: "/centrale", label: t("Centrale d'achat"), hint: t("Infrastructures au prix de gros") },
        { href: "/clones", label: t("Clones IA"), hint: t("Assistants des seniors") },
        { href: "/recruteurs", label: t("Espace recruteurs"), hint: t("Profils vérifiés") },
        ...(profile
          ? [
              { href: "/propositions", label: t("Mes propositions"), hint: t("Offres reçues des recruteurs") },
              { href: "/portefeuille", label: t("Portefeuille"), hint: t("Solde et transactions") },
            ]
          : []),
      ],
    },
  ];
  if (profile && ["moderator", "admin"].includes(profile.role)) {
    groups.push({
      label: t("Administration"),
      items: [{ href: "/moderation", label: t("Modération"), hint: t("Signalements, validations du Radar") }],
    });
  }
  return groups;
}

