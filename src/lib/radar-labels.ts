import { fcfa } from "@/lib/format";

export const ORG_TYPE: Record<string, string> = {
  pme: "PME",
  ong: "ONG",
  collectivite: "Collectivité",
  startup: "Startup",
  entreprise: "Entreprise",
};

export const RESPONSE_STATUS: Record<string, string> = {
  sent: "Envoyée",
  shortlisted: "Présélectionnée",
  accepted: "Retenue",
  declined: "Non retenue",
};

export function budgetLabel(min: number | null, max: number | null) {
  if (!min && !max) return "Budget non précisé";
  if (min && max && min !== max) return `${fcfa(min)} à ${fcfa(max)}`;
  return fcfa((max ?? min)!);
}

export const scoreClass = (score: number) =>
  score >= 70 ? "bg-leaf text-background" : score >= 50 ? "bg-gold text-background" : "border border-border text-muted";
