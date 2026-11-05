"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { parseTags, slugify } from "@/lib/format";

export async function createProject(formData: FormData) {
  const { supabase, user } = await requireSession("/showroom/new");
  const name = String(formData.get("name")).trim();
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const lookingForContributors = formData.get("contributors") === "on";

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name,
      slug,
      description: String(formData.get("description")).trim(),
      demo_url: String(formData.get("demo_url") || "") || null,
      repo_url: String(formData.get("repo_url") || "") || null,
      stack: parseTags(formData.get("stack")),
      status: String(formData.get("status") || "building"),
      looking_for_contributors: lookingForContributors,
    })
    .select("id, slug, stack")
    .single();
  if (error) redirect(`/showroom/new?error=${encodeURIComponent(error.message)}`);

  // « Je cherche des contributeurs » crée une Squad (§5.4)
  if (lookingForContributors) {
    const { data: squad } = await supabase
      .from("squads")
      .insert({
        owner_id: user.id,
        project_id: project.id,
        name: `Squad ${name}`,
        description: String(formData.get("squad_need") || "Rejoins le projet !"),
        roles_needed: parseTags(formData.get("roles")),
        skills_needed: project.stack,
      })
      .select("id")
      .single();
    if (squad) await supabase.from("projects").update({ squad_id: squad.id }).eq("id", project.id);
  }
  redirect(`/showroom/${project.slug}`);
}

export async function toggleLike(projectId: string, slug: string) {
  const { supabase, user } = await requireSession(`/showroom/${slug}`);
  const { data: liked } = await supabase
    .from("project_likes")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (liked) await supabase.from("project_likes").delete().eq("project_id", projectId).eq("user_id", user.id);
  else await supabase.from("project_likes").insert({ project_id: projectId, user_id: user.id });
  revalidatePath(`/showroom/${slug}`);
  revalidatePath("/showroom");
}

export async function electProjectOfWeek(projectId: string, slug: string) {
  const { supabase } = await requireSession(`/showroom/${slug}`);
  await supabase.rpc("elect_project_of_week", { p_project_id: projectId });
  revalidatePath(`/showroom/${slug}`);
}

export async function commentProject(projectId: string, slug: string, formData: FormData) {
  const { supabase, user } = await requireSession(`/showroom/${slug}`);
  const body = String(formData.get("body")).trim();
  if (body) await supabase.from("comments").insert({ author_id: user.id, target_type: "project", target_id: projectId, body });
  revalidatePath(`/showroom/${slug}`);
}

export async function decideAbandoned(projectId: string, slug: string, choice: "relancer" | "ceder" | "archiver") {
  const { supabase } = await requireSession(`/showroom/${slug}`);
  const { data: squadId, error } = await supabase.rpc("decide_abandoned_project", { p_project: projectId, p_choice: choice });
  if (error) redirect(`/showroom/${slug}?error=${encodeURIComponent(error.message)}`);
  if (squadId) redirect(`/squads/${squadId}`);
  revalidatePath(`/showroom/${slug}`);
  revalidatePath("/showroom/relancer");
}

export async function adoptProject(projectId: string, slug: string) {
  const { supabase } = await requireSession(`/showroom/${slug}`);
  const { error } = await supabase.rpc("adopt_project", { p_project: projectId });
  if (error) redirect(`/showroom/${slug}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/showroom/${slug}`);
  revalidatePath("/showroom/relancer");
}
