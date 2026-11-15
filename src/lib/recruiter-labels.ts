import { localized, tc } from "@/lib/i18n/current";
const OPEN_TO_FR = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "freelance", label: "Freelance" },
  { value: "stage", label: "Stage" },
  { value: "mission", label: "Mission courte" },
  { value: "remote", label: "Télétravail" },
] as const;

const OFFER_KIND_FR: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  freelance: "Freelance",
  stage: "Stage",
  mission: "Mission",
};

const CONTACT_STATUS_FR: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  declined: "Déclinée",
  expired: "Expirée",
};

const AVAILABILITY_FR: Record<string, string> = {
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
  const n = (count: number, one: string, many: string) => tc(count > 1 ? many : one, { n: count });
  return [
    { ok: e.github, label: tc("GitHub relié") },
    { ok: e.accepted_answers > 0, label: n(e.accepted_answers, "{n} réponse acceptée", "{n} réponses acceptées") },
    { ok: e.squads_completed > 0, label: n(e.squads_completed, "{n} Squad menée à terme", "{n} Squads menées à terme") },
    { ok: e.bounties_won > 0, label: n(e.bounties_won, "{n} prime gagnée", "{n} primes gagnées") },
    { ok: e.challenge_podiums > 0, label: n(e.challenge_podiums, "{n} podium de défi", "{n} podiums de défi") },
    { ok: e.audits > 0, label: n(e.audits, "{n} audit Code Forensic", "{n} audits Code Forensic") },
    { ok: e.projects > 0, label: n(e.projects, "{n} projet au Showroom", "{n} projets au Showroom") },
  ];
}

// Libellés traduits à la lecture (voir src/lib/i18n/current.ts)
export const OPEN_TO = localized(OPEN_TO_FR);
export const OFFER_KIND = localized(OFFER_KIND_FR);
export const CONTACT_STATUS = localized(CONTACT_STATUS_FR);
export const AVAILABILITY = localized(AVAILABILITY_FR);
