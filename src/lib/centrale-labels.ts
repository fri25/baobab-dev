import { localized } from "@/lib/i18n/current";
import { dateLocale } from "@/lib/i18n/current";
const INFRA_CATEGORY_FR: Record<string, string> = {
  calcul: "Calcul",
  base_de_donnees: "Base de données",
  build: "Build",
  sms: "SMS",
  ia: "IA",
  monitoring: "Monitoring",
  domaine: "Domaine",
};

const INFRA_UNIT_FR: Record<string, string> = {
  heure: "heure",
  sms: "SMS",
  "1k_jetons": "1 000 jetons",
  an: "an",
};

const PAUSE_REASON_FR: Record<string, string> = {
  manuel: "mise en pause par toi",
  budget: "plafond mensuel atteint",
  solde: "solde épuisé",
  abus_sms: "envoi massif de SMS détecté",
};

export const price = (n: number) => `${Number(n).toLocaleString(dateLocale(), { maximumFractionDigits: 2 })} FCFA`;
export const saving = (price: number, publicPrice: number) => Math.round((1 - price / publicPrice) * 100);

// Libellés traduits à la lecture (voir src/lib/i18n/current.ts)
export const INFRA_CATEGORY = localized(INFRA_CATEGORY_FR);
export const INFRA_UNIT = localized(INFRA_UNIT_FR);
export const PAUSE_REASON = localized(PAUSE_REASON_FR);
