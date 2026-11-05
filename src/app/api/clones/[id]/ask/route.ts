import { NextResponse } from "next/server";
import { askClone, CloneError } from "@/lib/clone";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Connecte-toi pour interroger un clone." }, { status: 401 });

  const { question } = (await request.json()) as { question?: string };
  if (!question || question.trim().length < 8) {
    return NextResponse.json({ error: "Pose une question un peu plus détaillée." }, { status: 400 });
  }
  try {
    return NextResponse.json(await askClone(id, data.user.id, question.trim().slice(0, 1000)));
  } catch (error) {
    if (error instanceof CloneError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
