import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Centrale d'achat (§8.2) : authentification des clés d'API personnelles et facturation à l'usage.

export type KeyedResource = { id: string; owner_id: string; status: string; pause_reason: string | null; category: string };

export function apiKeyFrom(request: Request) {
  return request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}

export async function resolveApiKey(key: string | null, category: "sms" | "ia"): Promise<KeyedResource | null> {
  if (!key?.startsWith("bk_")) return null;
  const hash = createHash("sha256").update(key).digest("hex");
  const { data } = await createAdminClient()
    .from("infra_resources")
    .select("id, owner_id, status, pause_reason, offer:infra_offers(category)")
    .eq("api_key_hash", hash)
    .maybeSingle();
  if (!data) return null;
  const offer = data.offer as unknown as { category: string };
  if (offer.category !== category) return null;
  return { id: data.id, owner_id: data.owner_id, status: data.status, pause_reason: data.pause_reason, category: offer.category };
}

export async function recordUsage(resourceId: string, quantity: number) {
  const { data, error } = await createAdminClient().rpc("record_usage", { p_resource: resourceId, p_quantity: quantity });
  if (error) throw new Error(error.message);
  return data as { amount: number; paused?: string };
}

export const PAUSED_MESSAGE: Record<string, string> = {
  budget: "Plafond mensuel atteint : relève-le sur Baobab Dev pour reprendre.",
  solde: "Solde épuisé : recharge ton portefeuille en Mobile Money pour reprendre.",
  abus_sms: "Ressource suspendue pour envoi massif de SMS.",
  manuel: "Ressource mise en pause par son propriétaire.",
};
