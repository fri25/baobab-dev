import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { askGriot } from "@/lib/griot";

// WhatsApp Business Cloud API : le Griot répond aux messages reçus (§6.1)
const GRAPH = "https://graph.facebook.com/v21.0";

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

function toWhatsApp(text: string) {
  return text.replace(/\*\*([^*]+)\*\*/g, "*$1*").replace(/```\w*\n?/g, "```");
}

async function reply(to: string, body: string) {
  await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000) } }),
  });
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
    await reply(
      message.from,
      `${toWhatsApp(result.answer)}${sources ? `\n\n*Sources*\n${sources}` : `\n\nPublie ta question : ${appUrl}/questions/new`}`,
    );
  }
  return NextResponse.json({ ok: true });
}
