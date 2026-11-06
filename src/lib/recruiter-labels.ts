export const OPEN_TO = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "freelance", label: "Freelance" },
  { value: "stage", label: "Stage" },
  { value: "mission", label: "Mission courte" },
  { value: "remote", label: "Télétravail" },
] as const;

export const OFFER_KIND: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  freelance: "Freelance",
  stage: "Stage",
  mission: "Mission",
};

export const CONTACT_STATUS: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  declined: "Déclinée",
  expired: "Expirée",
};

export const AVAILABILITY: Record<string, string> = {
  available: "Disponible",
  limited: "Disponibilité limitée",
  busy: "Occupé·e",
};

export type Evidence = {
  github: boolean;
  accepted_answers: number;
  squads_completed: number;
  bounties_won: number;
  challenge_podiums: number;
  audits: number;
  projects: number;
  badges: number;
  proofs: number;
  verified: boolean;
};

// Preuves affichables, dans l'ordre de lecture d'un recruteur
export function evidenceItems(e: Evidence) {
  return [
    { ok: e.github, label: "GitHub relié" },
    { ok: e.accepted_answers > 0, label: `${e.accepted_answers} réponse${e.accepted_answers > 1 ? "s" : ""} acceptée${e.accepted_answers > 1 ? "s" : ""}` },
    { ok: e.squads_completed > 0, label: `${e.squads_completed} Squad${e.squads_completed > 1 ? "s" : ""} menée${e.squads_completed > 1 ? "s" : ""} à terme` },
    { ok: e.bounties_won > 0, label: `${e.bounties_won} prime${e.bounties_won > 1 ? "s" : ""} gagnée${e.bounties_won > 1 ? "s" : ""}` },
    { ok: e.challenge_podiums > 0, label: `${e.challenge_podiums} podium${e.challenge_podiums > 1 ? "s" : ""} de défi` },
    { ok: e.audits > 0, label: `${e.audits} audit${e.audits > 1 ? "s" : ""} Code Forensic` },
    { ok: e.projects > 0, label: `${e.projects} projet${e.projects > 1 ? "s" : ""} au Showroom` },
  ];
}
