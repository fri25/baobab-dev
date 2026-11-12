"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { collectSources, extractOpportunity, matchAndAlert } from "@/lib/radar";

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

// Étape 2 : l'organisation corrige l'extraction et l'envoie à l'administration ;
// les profils correspondants sont alertés une fois l'opportunité validée.
export async function publishOpportunity(id: string, formData: FormData) {
  const { supabase, profile } = await requireSession(path(id));
  const moderator = ["moderator", "admin"].includes(profile.role);
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
      status: "pending",
    })
    .eq("id", id);
  if (error) redirect(`${path(id)}?brouillon=1&error=${encodeURIComponent(error.message)}`);
  if (moderator) await reviewAndAlert(id, true, null);
  redirect(path(id));
}

// Validation par l'administration : publication (et alertes) ou refus motivé
async function reviewAndAlert(id: string, approve: boolean, note: string | null) {
  const { supabase } = await requireSession(path(id));
  const { error } = await supabase.rpc("review_opportunity", { p_opportunity: id, p_approve: approve, p_note: note ?? "" });
  if (error) return error.message;
  if (approve) await matchAndAlert(id);
  revalidatePath("/radar");
  revalidatePath("/moderation");
  return null;
}

export async function reviewOpportunity(id: string, approve: boolean, formData: FormData) {
  const note = String(formData.get("note") || "").trim() || null;
  const back = String(formData.get("back") || path(id)).startsWith("/") ? String(formData.get("back") || path(id)) : path(id);
  const error = !approve && !note ? "Indique le motif du refus : il est transmis à l'organisation." : await reviewAndAlert(id, approve, note);
  if (error) redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}`);
  redirect(back);
}

export async function collectNow() {
  const { profile } = await requireSession("/moderation");
  if (!["moderator", "admin"].includes(profile.role)) return;
  await collectSources();
  revalidatePath("/moderation");
}

export async function closeOpportunity(id: string) {
  const { supabase } = await requireSession(path(id));
  await supabase.from("opportunities").update({ status: "closed" }).eq("id", id);
  revalidatePath(path(id));
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
