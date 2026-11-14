import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connecte-toi pour demander une validation." }, { status: 401 });

  const body: unknown = await request.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("queryId" in body) ||
    typeof body.queryId !== "string"
  ) {
    return NextResponse.json({ error: "Requête du Griot invalide." }, { status: 400 });
  }
  if (!("publicConsent" in body) || body.publicConsent !== true) {
    return NextResponse.json({ error: "Confirme que la question et la réponse peuvent être publiées." }, { status: 400 });
  }

  const { data: query, error: queryError } = await supabase
    .from("griot_queries")
    .select("id, question, answer, status, escalated_conversation_id")
    .eq("id", body.queryId)
    .single();
  if (queryError || !query) return NextResponse.json({ error: "Cette réponse du Griot est introuvable." }, { status: 404 });
  if (query.escalated_conversation_id) {
    return NextResponse.json({ conversationId: query.escalated_conversation_id, alreadyRequested: true });
  }
  if (!["answered", "escalated"].includes(query.status) || !query.answer) {
    return NextResponse.json({ error: "Seules les réponses du Griot peuvent être soumises à validation." }, { status: 400 });
  }

  const { data: skills, error: skillsError } = await supabase.from("skills").select("name").order("name");
  if (skillsError) return NextResponse.json({ error: "Impossible de trouver les experts à solliciter." }, { status: 500 });

  const searchableText = normalize(`${query.question}\n${query.answer}`);
  const tags = (skills ?? [])
    .filter(({ name }) => {
      const skill = normalize(name).trim();
      if (!skill) return false;
      return new RegExp(`(^|[^a-z0-9])${escapeRegExp(skill)}($|[^a-z0-9])`).test(searchableText);
    })
    .map(({ name }) => name)
    .slice(0, 5);

  const { data, error } = await supabase.rpc("request_griot_review", {
    p_query_id: query.id,
    p_tags: tags,
  });
  if (error) {
    console.error("Griot : impossible de créer la discussion de validation", error);
    return NextResponse.json({ error: "Impossible de publier la demande de validation dans les Discussions." }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (
    typeof result !== "object" ||
    result === null ||
    !("conversation_id" in result) ||
    typeof result.conversation_id !== "string" ||
    !("notified_experts" in result) ||
    typeof result.notified_experts !== "number"
  ) {
    console.error("Griot : réponse invalide de la création de discussion", data);
    return NextResponse.json({ error: "La demande de validation a renvoyé un résultat inattendu." }, { status: 500 });
  }

  return NextResponse.json({
    conversationId: result.conversation_id,
    notifiedExperts: result.notified_experts,
  });
}
