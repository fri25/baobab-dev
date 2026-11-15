import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { askGriot } from "@/lib/griot";
import { sendWhatsApp as reply, toWhatsApp } from "@/lib/whatsapp";

// Appels à l'IA ou à GitHub : au-delà du délai par défaut des fonctions Vercel
export const maxDuration = 90; // le Griot coupe lui-même l'appel au modèle à 60 s et répond en mode dégradé

// WhatsApp Business Cloud API : le Griot répond aux messages reçus (§6.1)

// Vérification du webhook par Meta
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(params.get("hub.challenge"));
  }
  return new Response("Forbidden", { status: 403 });
}

function validSignature(body: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

type Payload = {
  entry?: { changes?: { value?: { messages?: { from: string; type: string; text?: { body: string } }[] } }[] }[];
};

export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(raw) as Payload;
  const messages = payload.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];

  for (const message of messages) {
    if (message.type !== "text" || !message.text?.body) continue;
    const result = await askGriot(message.text.body.slice(0, 1000), null, "whatsapp");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://baobab.dev";
    const sources = result.sources
      .map((s, i) => `[${i + 1}] ${s.author_username}${s.author_city ? ` (${s.author_city})` : ""} : ${appUrl}/questions/${s.question_id}`)
      .join("\n");
    const expertReview =
      result.answerOrigin === "zai"
        ? `\n\n⚠️ Réponse du Griot non encore validée par la communauté. Pour demander un avis expert, retrouve cette question dans l’application : ${appUrl}/griot`
        : "";
    await reply(
      message.from,
      `${toWhatsApp(result.answer)}${expertReview}${sources ? `\n\n*Sources*\n${sources}` : ""}`,
    );
  }
  return NextResponse.json({ ok: true });
}
