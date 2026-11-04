"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { parseTags } from "@/lib/format";

export async function createSquad(formData: FormData) {
  const { supabase, user } = await requireSession("/squads/new");
  const { data, error } = await supabase
    .from("squads")
    .insert({
      owner_id: user.id,
      name: String(formData.get("name")).trim(),
      description: String(formData.get("description")).trim(),
      roles_needed: parseTags(formData.get("roles")),
      skills_needed: parseTags(formData.get("skills")),
      duration_weeks: Number(formData.get("duration_weeks")) || null,
      commitment: String(formData.get("commitment") || "") || null,
    })
    .select("id")
    .single();
  if (error) redirect(`/squads/new?error=${encodeURIComponent(error.message)}`);
  redirect(`/squads/${data.id}`);
}

const refresh = (squadId: string) => revalidatePath(`/squads/${squadId}`);

export async function applyToSquad(squadId: string, formData: FormData) {
  const { supabase, user } = await requireSession(`/squads/${squadId}`);
  await supabase.from("squad_members").insert({
    squad_id: squadId,
    user_id: user.id,
    role: String(formData.get("role") || "") || null,
    status: "applied",
  });
  refresh(squadId);
}

export async function inviteToSquad(squadId: string, userId: string) {
  const { supabase } = await requireSession(`/squads/${squadId}`);
  await supabase.from("squad_members").insert({ squad_id: squadId, user_id: userId, status: "invited" });
  refresh(squadId);
}

export async function acceptInvite(squadId: string) {
  const { supabase } = await requireSession(`/squads/${squadId}`);
  await supabase.rpc("accept_squad_invite", { p_squad_id: squadId });
  refresh(squadId);
}

export async function setMemberStatus(squadId: string, userId: string, status: "member" | "rejected" | "left") {
  const { supabase } = await requireSession(`/squads/${squadId}`);
  await supabase.from("squad_members").update({ status }).eq("squad_id", squadId).eq("user_id", userId);
  refresh(squadId);
}

export async function setSquadStatus(squadId: string, status: "active" | "completed" | "abandoned") {
  const { supabase } = await requireSession(`/squads/${squadId}`);
  await supabase.from("squads").update({ status }).eq("id", squadId);
  refresh(squadId);
}

export async function addTask(squadId: string, formData: FormData) {
  const { supabase } = await requireSession(`/squads/${squadId}`);
  const title = String(formData.get("title")).trim();
  if (title) await supabase.from("tasks").insert({ squad_id: squadId, title, position: Date.now() % 1_000_000 });
  refresh(squadId);
}

export async function moveTask(squadId: string, taskId: string, status: "todo" | "doing" | "done") {
  const { supabase, user } = await requireSession(`/squads/${squadId}`);
  await supabase.from("tasks").update({ status, assignee_id: user.id }).eq("id", taskId);
  refresh(squadId);
}

export async function sendSquadMessage(squadId: string, body: string) {
  const { supabase, user } = await requireSession(`/squads/${squadId}`);
  if (body.trim()) await supabase.from("squad_messages").insert({ squad_id: squadId, author_id: user.id, body: body.trim() });
}
