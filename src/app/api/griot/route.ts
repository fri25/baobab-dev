import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askGriot, GRIOT_DAILY_QUOTA } from "@/lib/griot";

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

  const result = await askGriot(question.trim().slice(0, 1000), data.user.id, channel === "whatsapp" ? "whatsapp" : "app");
  return NextResponse.json(result);
}
