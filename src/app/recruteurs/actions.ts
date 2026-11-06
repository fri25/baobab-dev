"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

const fail = (path: string, message: string): never => {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
};

export async function subscribe(formData: FormData) {
  const { supabase } = await requireSession("/recruteurs");
  const { error } = await supabase.rpc("subscribe_recruiter", { p_company: String(formData.get("company") || "") });
  if (error) fail("/recruteurs", error.message);
  revalidatePath("/recruteurs");
  redirect("/recruteurs?abonne=1");
}

export async function toggleShortlist(devId: string, back: string) {
  const { supabase } = await requireSession(back);
  const { error } = await supabase.rpc("toggle_shortlist", { p_dev: devId });
  if (error) fail(back, error.message);
  revalidatePath("/recruteurs", "layout");
  redirect(back);
}

export async function saveNote(devId: string, back: string, formData: FormData) {
  const { supabase } = await requireSession(back);
  const { error } = await supabase.rpc("toggle_shortlist", { p_dev: devId, p_note: String(formData.get("note") || "") });
  if (error) fail(back, error.message);
  revalidatePath("/recruteurs", "layout");
  redirect(back);
}

export async function sendContact(devId: string, back: string, formData: FormData) {
  const { supabase } = await requireSession(back);
  const { error } = await supabase.rpc("send_recruiter_contact", {
    p_dev: devId,
    p_offer_kind: String(formData.get("offer_kind")),
    p_title: String(formData.get("title") || ""),
    p_message: String(formData.get("message") || ""),
    p_budget: String(formData.get("budget") || "") || undefined,
  });
  if (error) {
    const msg = error.message.includes("recruiter_contacts_message_check")
      ? "Le message doit faire entre 20 et 1 500 caractères."
      : error.message.includes("recruiter_contacts_title_check")
        ? "Le titre doit faire entre 3 et 120 caractères."
        : error.message;
    fail(back, msg);
  }
  revalidatePath("/recruteurs", "layout");
  redirect(`${back}?envoye=1`);
}

export async function respondContact(contactId: string, accept: boolean, formData: FormData) {
  const { supabase } = await requireSession("/propositions");
  const { data, error } = await supabase.rpc("respond_recruiter_contact", {
    p_contact: contactId,
    p_accept: accept,
    p_reason: String(formData.get("reason") || "") || undefined,
  });
  if (error) fail("/propositions", error.message);
  revalidatePath("/propositions");
  if (accept && data) redirect(`/discussions/${data}`);
  redirect("/propositions");
}
