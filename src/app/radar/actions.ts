"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { extractOpportunity, matchAndAlert } from "@/lib/radar";

const path = (id: string) => `/radar/${id}`;

// Étape 1 : l'organisation colle son texte, l'IA (ou les règles) en extrait un brouillon
export async function draftOpportunity(formData: FormData) {
  const { supabase, user } = await requireSession("/radar/publier");
  const raw = String(formData.get("raw_text")).trim();
  if (raw.length < 40) redirect(`/radar/publier?error=${encodeURIComponent("Décris le besoin en quelques phrases (40 caractères minimum).")}`);
  const { data: x, by } = await extractOpportunity(raw);
  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      source: "publiee",
      publisher_id: user.id,
      organization_name: String(formData.get("organization_name") || "").trim() || x.organization_name || "Organisation",
      org_type: String(formData.get("org_type") || x.org_type),
      title: x.title,
      raw_text: raw,
      need: x.need,
      technologies: x.technologies,
      budget_min: x.budget_min,
      budget_max: x.budget_max,
      deadline: x.deadline,
      country: x.country,
      city: x.city,
      contact: String(formData.get("contact") || "").trim() || null,
      extracted_by: by,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) redirect(`/radar/publier?error=${encodeURIComponent(error.message)}`);
  redirect(`${path(data.id)}?brouillon=1`);
}

// Étape 2 : l'organisation corrige l'extraction et publie ; les profils correspondants sont alertés
export async function publishOpportunity(id: string, formData: FormData) {
  const { supabase } = await requireSession(path(id));
  const num = (key: string) => (formData.get(key) ? Number(formData.get(key)) : null);
  const { error } = await supabase
    .from("opportunities")
    .update({
      title: String(formData.get("title")).trim(),
      need: String(formData.get("need")).trim(),
      organization_name: String(formData.get("organization_name")).trim(),
      org_type: String(formData.get("org_type")),
      technologies: String(formData.get("technologies") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8),
      budget_min: num("budget_min"),
      budget_max: num("budget_max"),
      deadline: String(formData.get("deadline") || "") || null,
      country: String(formData.get("country") || "") || null,
      city: String(formData.get("city") || "") || null,
      contact: String(formData.get("contact") || "") || null,
    })
    .eq("id", id);
  if (error) redirect(`${path(id)}?brouillon=1&error=${encodeURIComponent(error.message)}`);
  const { error: submitError } = await supabase.rpc("submit_opportunity_for_review", { p_opportunity: id });
  if (submitError) redirect(`${path(id)}?brouillon=1&error=${encodeURIComponent(submitError.message)}`);
  redirect(`${path(id)}?soumis=1`);
}

export async function closeOpportunity(id: string) {
  const { supabase } = await requireSession(path(id));
  const { error } = await supabase.rpc("close_opportunity", { p_opportunity: id });
  if (error) redirect(`${path(id)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path(id));
}

export async function moderateOpportunity(id: string, formData: FormData) {
  const { supabase } = await requireSession("/moderation");
  const action = formData.get("action") === "approve" ? "approve" : "reject";
  const { error } = await supabase.rpc("moderate_opportunity", {
    p_opportunity: id,
    p_action: action,
    p_note: String(formData.get("note") ?? ""),
  });
  if (error) redirect(`/moderation?radarError=${encodeURIComponent(error.message)}#radar-review`);
  if (action === "approve") await matchAndAlert(id);
  revalidatePath("/radar");
  revalidatePath(path(id));
  revalidatePath("/moderation");
  redirect(`/moderation?radar=${action === "approve" ? "approved" : "rejected"}#radar-review`);
}

export async function respond(id: string, formData: FormData) {
  const { supabase } = await requireSession(path(id));
  const { error } = await supabase.rpc("respond_opportunity", {
    p_opportunity: id,
    p_message: String(formData.get("message")),
    p_budget: formData.get("proposed_budget") ? Number(formData.get("proposed_budget")) : null,
    p_squad: String(formData.get("squad_id") || "") || null,
  });
  if (error) redirect(`${path(id)}?error=${encodeURIComponent(error.code === "23505" ? "Tu as déjà répondu à cette opportunité." : error.message)}`);
  revalidatePath(path(id));
}

export async function setResponseStatus(id: string, responseId: string, status: "shortlisted" | "accepted" | "declined") {
  const { supabase } = await requireSession(path(id));
  const { error } = await supabase.rpc("set_response_status", { p_response: responseId, p_status: status });
  if (error) redirect(`${path(id)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path(id));
}
