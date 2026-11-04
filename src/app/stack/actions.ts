"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { slugify } from "@/lib/format";

const path = (slug: string) => `/stack/${slug}`;

export async function proposeStackItem(formData: FormData) {
  const { supabase, user } = await requireSession("/stack/new");
  const name = String(formData.get("name")).trim();
  const slug = slugify(name);
  const opt = (key: string) => String(formData.get(key) || "").trim() || null;
  const { error } = await supabase.from("stack_items").insert({
    name,
    slug,
    category: String(formData.get("category")),
    description: String(formData.get("description")).trim(),
    website: opt("website"),
    docs_url: opt("docs_url"),
    compatible_versions: opt("compatible_versions"),
    code_example: opt("code_example"),
    pitfalls: opt("pitfalls"),
    health_url: opt("health_url"),
    created_by: user.id,
  });
  if (error) redirect(`/stack/new?error=${encodeURIComponent(error.code === "23505" ? "Cet outil existe déjà" : error.message)}`);
  redirect(path(slug));
}

export async function attest(itemId: string, slug: string, formData: FormData) {
  const { supabase, user } = await requireSession(path(slug));
  await supabase.from("stack_attestations").insert({
    item_id: itemId,
    user_id: user.id,
    in_production: true,
    comment: String(formData.get("comment") || "") || null,
  });
  revalidatePath(path(slug));
}

export async function withdrawAttestation(itemId: string, slug: string) {
  const { supabase, user } = await requireSession(path(slug));
  await supabase.from("stack_attestations").delete().eq("item_id", itemId).eq("user_id", user.id);
  revalidatePath(path(slug));
}

export async function setStackStatus(itemId: string, slug: string, status: "verifie" | "deconseille" | "test") {
  const { supabase } = await requireSession(path(slug));
  const { error } = await supabase.rpc("validate_stack_item", { p_item_id: itemId, p_status: status });
  if (error) redirect(`${path(slug)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path(slug));
}
