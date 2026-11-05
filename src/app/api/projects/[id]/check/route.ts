import { NextResponse } from "next/server";
import { checkProjectRepo } from "@/lib/abandoned";
import { createClient } from "@/lib/supabase/server";

// Vérification à la demande de l'activité du dépôt (propriétaire uniquement)
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });

  const { data: project } = await supabase.from("projects").select("owner_id, repo_url").eq("id", id).single();
  if (!project || project.owner_id !== auth.user.id) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  if (!project.repo_url) return NextResponse.json({ error: "Aucun dépôt lié" }, { status: 400 });

  const result = await checkProjectRepo(id, project.repo_url);
  if (!result.checked) return NextResponse.json({ error: "Dépôt GitHub illisible (privé ou introuvable)" }, { status: 400 });
  return NextResponse.json(result);
}
