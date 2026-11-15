import { SidebarNav, type SidebarSquad } from "@/components/SidebarNav";
import { getT } from "@/lib/i18n/server";
import { currentUser, navGroups } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";

// Barre latérale : navigation par rubriques et Squads dont on est membre
export async function Sidebar() {
  const t = await getT();
  const profile = await currentUser();
  let squads: SidebarSquad[] = [];

  if (profile) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("squad_members")
      .select("squad:squads!inner(id, name, status, squad_members(count))")
      .eq("user_id", profile.id)
      .eq("status", "member")
      .limit(6);
    squads = (data ?? []).map((row) => {
      const squad = row.squad as unknown as { id: string; name: string; squad_members: { count: number }[] };
      return { id: squad.id, name: squad.name, members: squad.squad_members[0]?.count ?? 0 };
    });
  }

  return <SidebarNav groups={navGroups(profile, t)} squads={squads} />;
}
