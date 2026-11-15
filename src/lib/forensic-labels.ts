import { localized } from "@/lib/i18n/current";
const SEVERITY_FR = {
  critique: { label: "Critique", weight: 15, className: "bg-danger text-white" },
  moyen: { label: "Moyen", weight: 6, className: "bg-gold text-background" },
  mineur: { label: "Mineur", weight: 2, className: "border border-border text-muted" },
} as const;

const FINDING_CATEGORY_FR: Record<string, string> = {
  securite: "Sécurité",
  dependances: "Dépendances",
  duplication: "Duplication",
  tests: "Tests",
  architecture: "Architecture",
  performance: "Performance",
  autre: "Autre",
};

const AUDIT_STATUS_FR: Record<string, string> = {
  open: "Recherche d'auditeurs",
  in_progress: "Audit en cours",
  closed: "Rapport final publié",
  refunded: "Expiré, remboursé",
};

export function scoreColor(score: number) {
  return score >= 75 ? "var(--leaf)" : score >= 50 ? "var(--gold)" : "var(--danger)";
}

// Libellés traduits à la lecture (voir src/lib/i18n/current.ts)
export const SEVERITY = localized(SEVERITY_FR);
export const FINDING_CATEGORY = localized(FINDING_CATEGORY_FR);
export const AUDIT_STATUS = localized(AUDIT_STATUS_FR);
