export const PROJECT_STATUS: Record<string, string> = {
  idea: "Idée",
  building: "En construction",
  launched: "Lancé",
  paused: "En pause",
  abandoned: "À relancer",
};

export const SQUAD_STATUS: Record<string, string> = {
  recruiting: "Recrute",
  active: "En cours",
  completed: "Terminée",
  abandoned: "Abandonnée",
};

export const BOUNTY_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "Ouvert", color: "var(--leaf)" },
  reserved: { label: "Réservé 48 h", color: "var(--gold)" },
  in_review: { label: "En revue", color: "var(--gold)" },
  paid: { label: "Prime versée", color: "var(--muted)" },
  expired: { label: "Expiré", color: "var(--muted)" },
  refunded: { label: "Remboursé", color: "var(--muted)" },
  disputed: { label: "Litige", color: "var(--primary)" },
};

export const CHALLENGE_KIND: Record<string, string> = {
  algo: "Algorithmique",
  interface: "Interface",
  api: "API",
};

export const STACK_CATEGORY: Record<string, string> = {
  paiement: "Paiement",
  sms: "SMS",
  ussd: "USSD",
  identite: "Identité",
  cartographie: "Cartographie",
  autre: "Autre",
};

export const STACK_STATUS: Record<string, { label: string; className: string }> = {
  test: { label: "En test", className: "border border-border text-muted" },
  verifie: { label: "Vérifié ✓", className: "bg-leaf text-background" },
  deconseille: { label: "Déconseillé", className: "bg-primary text-primary-ink" },
};

export const XP_REASONS: Record<string, string> = {
  answer_upvoted: "Réponse votée positivement",
  answer_accepted: "Réponse acceptée",
  griot_citation: "Réponse citée par le Griot",
  project_published: "Projet publié",
  project_of_week: "Projet de la semaine",
  squad_completed: "Squad terminée",
  squad_abandoned: "Squad abandonnée",
  bounty_resolved: "Ticket de la Micro-Bourse résolu",
  content_removed: "Contenu supprimé par la modération",
  challenge_won: "Podium d'un défi",
  audit_completed: "Audit Code Forensic",
  project_adopted: "Reprise d'un projet abandonné",
  seed_history: "Contributions passées",
};
