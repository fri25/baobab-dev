import { localized } from "@/lib/i18n/current";
const PROJECT_STATUS_FR: Record<string, string> = {
  idea: "Idée",
  building: "En construction",
  launched: "Lancé",
  paused: "En pause",
  abandoned: "À relancer",
};

const SQUAD_STATUS_FR: Record<string, string> = {
  recruiting: "Recrute",
  active: "En cours",
  completed: "Terminée",
  abandoned: "Abandonnée",
};

const BOUNTY_STATUS_FR: Record<string, { label: string; color: string }> = {
  open: { label: "Ouvert", color: "var(--leaf)" },
  reserved: { label: "Réservé 48 h", color: "var(--gold)" },
  in_review: { label: "En revue", color: "var(--gold)" },
  paid: { label: "Prime versée", color: "var(--muted)" },
  expired: { label: "Expiré", color: "var(--muted)" },
  refunded: { label: "Remboursé", color: "var(--muted)" },
  disputed: { label: "Litige", color: "var(--danger)" },
};

const CHALLENGE_KIND_FR: Record<string, string> = {
  algo: "Algorithmique",
  interface: "Interface",
  api: "API",
};

const STACK_CATEGORY_FR: Record<string, string> = {
  paiement: "Paiement",
  sms: "SMS",
  ussd: "USSD",
  identite: "Identité",
  cartographie: "Cartographie",
  autre: "Autre",
};

const STACK_STATUS_FR: Record<string, { label: string; className: string }> = {
  test: { label: "En test", className: "border border-border text-muted" },
  verifie: { label: "Vérifié ✓", className: "bg-leaf text-background" },
  deconseille: { label: "Déconseillé", className: "bg-danger text-white" },
};

const XP_REASONS_FR: Record<string, string> = {
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

// Libellés traduits à la lecture (voir src/lib/i18n/current.ts)
export const PROJECT_STATUS = localized(PROJECT_STATUS_FR);
export const SQUAD_STATUS = localized(SQUAD_STATUS_FR);
export const BOUNTY_STATUS = localized(BOUNTY_STATUS_FR);
export const CHALLENGE_KIND = localized(CHALLENGE_KIND_FR);
export const STACK_CATEGORY = localized(STACK_CATEGORY_FR);
export const STACK_STATUS = localized(STACK_STATUS_FR);
export const XP_REASONS = localized(XP_REASONS_FR);
