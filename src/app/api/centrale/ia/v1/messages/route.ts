import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { apiKeyFrom, PAUSED_MESSAGE, recordUsage, resolveApiKey } from "@/lib/centrale";
import { hasAnthropicCredentials } from "@/lib/griot";

// Appels à l'IA ou à GitHub : au-delà du délai par défaut des fonctions Vercel
export const maxDuration = 60;

// Proxy compatible avec l'API Messages : la clé Baobab (bk_…) remplace la clé du fournisseur,
// les jetons consommés sont facturés au millier sur le portefeuille du membre.
export async function POST(request: Request) {
  const resource = await resolveApiKey(apiKeyFrom(request), "ia");
  if (!resource) return NextResponse.json({ type: "error", error: { type: "authentication_error", message: "Clé d'API invalide" } }, { status: 401 });
  if (resource.status !== "active") {
    return NextResponse.json(
      { type: "error", error: { type: "permission_error", message: PAUSED_MESSAGE[resource.pause_reason ?? "manuel"] } },
      { status: 402 },
    );
  }
  if (!hasAnthropicCredentials()) {
    return NextResponse.json({ type: "error", error: { type: "api_error", message: "Fournisseur d'IA non configuré sur ce serveur" } }, { status: 503 });
  }

  const body = (await request.json()) as Anthropic.MessageCreateParamsNonStreaming;
  if (body.stream) {
    return NextResponse.json({ type: "error", error: { type: "invalid_request_error", message: "Le streaming n'est pas encore proposé par la Centrale" } }, { status: 400 });
  }
  const client = new Anthropic();
  try {
    const message = await client.messages.create({ ...body, max_tokens: Math.min(body.max_tokens ?? 4000, 16000) });
    const tokens = message.usage.input_tokens + message.usage.output_tokens;
    const billing = await recordUsage(resource.id, tokens / 1000);
    return NextResponse.json(message, { headers: { "x-baobab-cost-fcfa": String(billing.amount) } });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ type: "error", error: { type: "api_error", message: error.message } }, { status: error.status ?? 500 });
    }
    throw error;
  }
}
