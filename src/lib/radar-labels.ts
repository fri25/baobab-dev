import { localized, tc } from "@/lib/i18n/current";
import { fcfa } from "@/lib/format";

const ORG_TYPE_FR: Record<string, string> = {
  pme: "PME",
  ong: "ONG",
  collectivite: "Collectivité",
  startup: "Startup",
  entreprise: "Entreprise",
};

const RESPONSE_STATUS_FR: Record<string, string> = {
  sent: "Envoyée",
  shortlisted: "Présélectionnée",
  accepted: "Retenue",
  declined: "Non retenue",
};

export function budgetLabel(min: number | null, max: number | null) {
  if (!min && !max) return tc("Budget non précisé");
  if (min && max && min !== max) return tc("{min} à {max}", { min: fcfa(min), max: fcfa(max) });
  return fcfa((max ?? min)!);
}

export const scoreClass = (score: number) =>
  score >= 70 ? "bg-leaf text-background" : score >= 50 ? "bg-gold text-background" : "border border-border text-muted";

export function daysUntilDeadline(deadline: string, now = Date.now()) {
  const beninToday = new Date(now + 60 * 60 * 1000).toISOString().slice(0, 10);
  const due = Date.parse(`${deadline}T00:00:00Z`);
  const today = Date.parse(`${beninToday}T00:00:00Z`);
  return Math.round((due - today) / 86_400_000);
}

// Libellés traduits à la lecture (voir src/lib/i18n/current.ts)
export const ORG_TYPE = localized(ORG_TYPE_FR);
export const RESPONSE_STATUS = localized(RESPONSE_STATUS_FR);
