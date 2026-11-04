"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { parseTags } from "@/lib/format";
import { embedAnswer } from "@/lib/griot";
import { validImageUrls } from "@/lib/images";

export async function createQuestion(formData: FormData) {
  const { supabase, user } = await requireSession("/questions/new");
  const { data, error } = await supabase
    .from("questions")
    .insert({
      author_id: user.id,
      title: String(formData.get("title")).trim(),
      body: String(formData.get("body")).trim(),
      tags: parseTags(formData.get("tags")),
      images: validImageUrls(formData.getAll("images"), user.id),
    })
    .select("id")
    .single();
  if (error) redirect(`/questions/new?error=${encodeURIComponent(error.message)}`);
  redirect(`/questions/${data.id}`);
}

export async function createAnswer(questionId: string, formData: FormData) {
  const { supabase, user } = await requireSession(`/questions/${questionId}`);
  const body = String(formData.get("body")).trim();
  if (!body) return;
  const { data } = await supabase
    .from("answers")
    .insert({ question_id: questionId, author_id: user.id, body, images: validImageUrls(formData.getAll("images"), user.id) })
    .select("id")
    .single();
  if (data) await embedAnswer(data.id, body);
  revalidatePath(`/questions/${questionId}`);
}

export async function vote(questionId: string, answerId: string, value: 1 | -1) {
  const { supabase, user } = await requireSession(`/questions/${questionId}`);
  const { data: existing } = await supabase
    .from("votes")
    .select("value")
    .eq("user_id", user.id)
    .eq("answer_id", answerId)
    .maybeSingle();

  if (existing?.value === value) {
    await supabase.from("votes").delete().eq("user_id", user.id).eq("answer_id", answerId);
  } else if (existing) {
    await supabase.from("votes").update({ value }).eq("user_id", user.id).eq("answer_id", answerId);
  } else {
    await supabase.from("votes").insert({ user_id: user.id, answer_id: answerId, value });
  }
  revalidatePath(`/questions/${questionId}`);
}

export async function acceptAnswer(questionId: string, answerId: string) {
  const { supabase } = await requireSession(`/questions/${questionId}`);
  await supabase.rpc("accept_answer", { p_answer_id: answerId });
  revalidatePath(`/questions/${questionId}`);
}

export async function addComment(questionId: string, targetType: "question" | "answer", targetId: string, formData: FormData) {
  const { supabase, user } = await requireSession(`/questions/${questionId}`);
  const body = String(formData.get("body")).trim();
  if (body) await supabase.from("comments").insert({ author_id: user.id, target_type: targetType, target_id: targetId, body });
  revalidatePath(`/questions/${questionId}`);
}

export async function similarQuestions(text: string) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  if (text.trim().length < 8) return [];
  const { data } = await supabase.rpc("similar_questions", { p_query: text, match_count: 4 });
  return (data ?? []) as { id: string; title: string; answers_count: number; has_accepted: boolean }[];
}
