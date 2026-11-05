"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { embedCloneSource } from "@/lib/clone";

const MINE = "/clones/mon-clone";
const back = (error?: { message: string } | null) => {
  if (error) redirect(`${MINE}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(MINE);
};

export async function createClone(formData: FormData) {
  const { supabase } = await requireSession(MINE);
  const { error } = await supabase.rpc("create_clone", {
    p_name: String(formData.get("name")),
    p_specialty: String(formData.get("specialty")),
    p_description: String(formData.get("description") || ""),
    p_style: String(formData.get("style_notes") || ""),
  });
  back(error);
}

export async function updateClone(cloneId: string, formData: FormData) {
  const { supabase } = await requireSession(MINE);
  const { error } = await supabase
    .from("ai_clones")
    .update({
      name: String(formData.get("name")).trim(),
      specialty: String(formData.get("specialty")).trim(),
      description: String(formData.get("description") || "").trim() || null,
      style_notes: String(formData.get("style_notes") || "").trim() || null,
    })
    .eq("id", cloneId);
  back(error);
}

export async function addAnswerSource(answerId: string) {
  const { supabase } = await requireSession(MINE);
  const { error } = await supabase.rpc("add_clone_answer_source", { p_answer_id: answerId });
  if (!error) {
    const { data } = await supabase.from("clone_sources").select("id, title, content").eq("answer_id", answerId).single();
    if (data) await embedCloneSource(data.id, data.title, data.content);
  }
  back(error);
}

export async function addNoteSource(cloneId: string, formData: FormData) {
  const { supabase } = await requireSession(MINE);
  const title = String(formData.get("title")).trim();
  const content = String(formData.get("content")).trim();
  const { data, error } = await supabase
    .from("clone_sources")
    .insert({ clone_id: cloneId, kind: "note", title, content })
    .select("id")
    .single();
  if (data) await embedCloneSource(data.id, title, content);
  back(error);
}

export async function removeSource(sourceId: string) {
  const { supabase } = await requireSession(MINE);
  const { error } = await supabase.from("clone_sources").delete().eq("id", sourceId);
  back(error);
}

export async function setCloneStatus(status: "draft" | "published") {
  const { supabase } = await requireSession(MINE);
  const { error } = await supabase.rpc("set_clone_status", { p_status: status });
  back(error);
}

export async function buyPass(cloneId: string) {
  const { supabase } = await requireSession(`/clones/${cloneId}`);
  const { error } = await supabase.rpc("buy_clone_pass");
  if (error) redirect(`/clones/${cloneId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/clones/${cloneId}`);
}

export async function rateQuery(queryId: string, rating: number) {
  const { supabase } = await requireSession("/clones");
  const { error } = await supabase.rpc("rate_clone_query", { p_query: queryId, p_rating: rating });
  return { error: error?.message ?? null };
}

export async function flagQuery(queryId: string, reason: string) {
  const { supabase } = await requireSession("/clones");
  const { error } = await supabase.rpc("flag_clone_query", { p_query: queryId, p_reason: reason });
  return { error: error?.message ?? null };
}
