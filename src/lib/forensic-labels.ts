export const SEVERITY = {
  critique: { label: "Critique", weight: 15, className: "bg-primary text-primary-ink" },
  moyen: { label: "Moyen", weight: 6, className: "bg-gold text-background" },
  mineur: { label: "Mineur", weight: 2, className: "border border-border text-muted" },
} as const;

export const FINDING_CATEGORY: Record<string, string> = {
  securite: "Sécurité",
  dependances: "Dépendances",
  duplication: "Duplication",
  tests: "Tests",
  architecture: "Architecture",
  performance: "Performance",
  autre: "Autre",
};

export const AUDIT_STATUS: Record<string, string> = {
  open: "Recherche d'auditeurs",
  in_progress: "Audit en cours",
  closed: "Rapport final publié",
  refunded: "Expiré, remboursé",
};

export function scoreColor(score: number) {
  return score >= 75 ? "var(--leaf)" : score >= 50 ? "var(--gold)" : "var(--primary)";
}
