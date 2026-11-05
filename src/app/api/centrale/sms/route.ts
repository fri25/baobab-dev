import { NextResponse } from "next/server";
import { apiKeyFrom, PAUSED_MESSAGE, recordUsage, resolveApiKey } from "@/lib/centrale";
import { createAdminClient } from "@/lib/supabase/admin";

// Passerelle SMS de la Centrale. Bac à sable : les SMS sont validés et facturés, mais pas encore
// transmis à un opérateur (branchement de la passerelle régionale en production).
export async function POST(request: Request) {
  const resource = await resolveApiKey(apiKeyFrom(request), "sms");
  if (!resource) return NextResponse.json({ error: "Clé d'API invalide" }, { status: 401 });
  if (resource.status !== "active") {
    return NextResponse.json({ error: PAUSED_MESSAGE[resource.pause_reason ?? "manuel"] }, { status: resource.pause_reason === "abus_sms" ? 429 : 402 });
  }

  const { to, message } = (await request.json()) as { to?: string; message?: string };
  const phone = String(to ?? "").replace(/[\s.-]/g, "");
  if (!/^\+?[0-9]{8,15}$/.test(phone)) return NextResponse.json({ error: "Numéro invalide (format international)" }, { status: 400 });
  if (!message?.trim() || message.length > 480) return NextResponse.json({ error: "Message vide ou trop long (480 caractères max.)" }, { status: 400 });

  const segments = Math.ceil(message.length / 160); // un SMS fait 160 caractères
  const billing = await recordUsage(resource.id, segments);
  if (billing.paused) return NextResponse.json({ error: PAUSED_MESSAGE[billing.paused] }, { status: 402 });
  const { data: abuse } = await createAdminClient().rpc("check_sms_abuse", { p_resource: resource.id });

  return NextResponse.json({
    id: crypto.randomUUID(),
    to: phone,
    segments,
    cost_fcfa: billing.amount,
    status: "accepte_bac_a_sable",
    ...(abuse ? { warning: "Limite anti-spam atteinte : la ressource est suspendue." } : {}),
  });
}
