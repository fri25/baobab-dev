"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

const HOME = "/centrale";
const back = (path: string, error?: { message: string } | null) => {
  if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path);
};

export async function joinCentrale() {
  const { supabase } = await requireSession(HOME);
  const { error } = await supabase.rpc("join_centrale");
  back(HOME, error);
}

export async function setBudget(formData: FormData) {
  const { supabase } = await requireSession(HOME);
  const { error } = await supabase.rpc("set_infra_budget", { p_cap: Number(formData.get("cap")) });
  back(HOME, error);
}

// Renvoie la clé d'API en clair une seule fois : elle n'est jamais stockée
export async function createResource(_prev: unknown, formData: FormData) {
  const { supabase } = await requireSession(`${HOME}/nouvelle`);
  const { data, error } = await supabase
    .rpc("create_infra_resource", {
      p_offer_code: String(formData.get("offer")),
      p_name: String(formData.get("name")),
      p_project: String(formData.get("project_id") || "") || null,
      p_squad: String(formData.get("squad_id") || "") || null,
    })
    .single<{ resource_id: string; api_key: string | null }>();
  if (error) return { error: error.message };
  revalidatePath(HOME);
  return { resourceId: data.resource_id, apiKey: data.api_key };
}

export async function setResourceStatus(id: string, status: "active" | "paused" | "deleted") {
  const { supabase } = await requireSession(`${HOME}/ressources/${id}`);
  const { error } = await supabase.rpc("set_infra_resource_status", { p_resource: id, p_status: status });
  if (status === "deleted" && !error) redirect(HOME);
  back(`${HOME}/ressources/${id}`, error);
}

export async function propose(formData: FormData) {
  const { supabase, user } = await requireSession(HOME);
  const { error } = await supabase.from("infra_proposals").insert({
    title: String(formData.get("title")).trim(),
    description: String(formData.get("description") || "").trim() || null,
    proposed_by: user.id,
  });
  back(HOME, error);
}

export async function vote(proposalId: string) {
  const { supabase } = await requireSession(HOME);
  const { error } = await supabase.rpc("vote_infra_proposal", { p_proposal: proposalId });
  back(HOME, error);
}
