import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askGriot, GRIOT_DAILY_QUOTA } from "@/lib/griot";

// Appels à l'IA ou à GitHub : au-delà du délai par défaut des fonctions Vercel
export const maxDuration = 90; // le Griot coupe lui-même l'appel au modèle à 60 s et répond en mode dégradé

const HISTORY_PAGE_SIZE = 30;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Connecte-toi pour consulter ton historique." }, { status: 401 });

  const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
  const offset = Number(rawOffset);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return NextResponse.json({ error: "Position d’historique invalide." }, { status: 400 });
  }

  const initialHistory = await supabase
    .from("griot_queries")
    .select("id, question, answer, created_at, escalated_conversation_id, escalated_question_id")
    .eq("user_id", data.user.id)
    .not("answer", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE);
  let history = initialHistory.data;
  let error = initialHistory.error;
  if (error?.message.includes("escalated_conversation_id")) {
    console.error("Griot : migration de discussions non appliquée, chargement de l’historique sans lien de discussion");
    const fallbackHistory = await supabase
      .from("griot_queries")
      .select("id, question, answer, created_at, escalated_question_id")
      .eq("user_id", data.user.id)
      .not("answer", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + HISTORY_PAGE_SIZE);
    history = fallbackHistory.data?.map((item) => ({ ...item, escalated_conversation_id: null })) ?? null;
    error = fallbackHistory.error;
  }
  if (error) {
    console.error("Griot : impossible de charger une page d’historique", error);
    return NextResponse.json({ error: "Impossible de charger l’historique." }, { status: 500 });
  }

  return NextResponse.json({
    history: (history ?? []).slice(0, HISTORY_PAGE_SIZE),
    hasMore: (history?.length ?? 0) > HISTORY_PAGE_SIZE,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Connecte-toi pour interroger le Griot." }, { status: 401 });

  const { question, channel } = (await request.json()) as { question?: string; channel?: "app" | "whatsapp" };
  if (!question || question.trim().length < 8) {
    return NextResponse.json({ error: "Pose une question un peu plus détaillée." }, { status: 400 });
  }

  const { data: used } = await supabase.rpc("griot_queries_today", { p_user: data.user.id });
  if ((used ?? 0) >= GRIOT_DAILY_QUOTA) {
    return NextResponse.json({ error: `Quota quotidien atteint (${GRIOT_DAILY_QUOTA} questions).` }, { status: 429 });
  }

  try {
    const result = await askGriot(question.trim().slice(0, 1000), data.user.id, channel === "whatsapp" ? "whatsapp" : "app");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Griot : échec du traitement de la question", error);
    return NextResponse.json({ error: "Le Griot est temporairement indisponible. Réessaie dans un instant." }, { status: 502 });
  }
}
