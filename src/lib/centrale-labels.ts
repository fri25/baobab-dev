export const INFRA_CATEGORY: Record<string, string> = {
  calcul: "Calcul",
  base_de_donnees: "Base de données",
  build: "Build",
  sms: "SMS",
  ia: "IA",
  monitoring: "Monitoring",
  domaine: "Domaine",
};

export const INFRA_UNIT: Record<string, string> = {
  heure: "heure",
  sms: "SMS",
  "1k_jetons": "1 000 jetons",
  an: "an",
};

export const PAUSE_REASON: Record<string, string> = {
  manuel: "mise en pause par toi",
  budget: "plafond mensuel atteint",
  solde: "solde épuisé",
  abus_sms: "envoi massif de SMS détecté",
};

export const price = (n: number) => `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} FCFA`;
export const saving = (price: number, publicPrice: number) => Math.round((1 - price / publicPrice) * 100);
