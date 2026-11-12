// Accord de confidentialité de Code Forensic : un seul texte, affiché dans le formulaire et repris dans le PDF signé.
export const NDA_VERSION = "nda-2026-11";

export type NdaContext = {
  auditId: string;
  projectTitle: string;
  repoUrl: string;
  ownerName: string;
  ownerUsername: string;
  auditorName: string; // nom saisi à la signature (ou nom du profil avant signature)
  auditorUsername: string;
  deadline: string; // échéance de l'audit
};

const date = (d: string | Date) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Porto-Novo" });

export function ndaParties(c: NdaContext) {
  return [
    `Le Porteur : ${c.ownerName} (@${c.ownerUsername}), qui soumet son code à l'audit.`,
    `L'Auditeur : ${c.auditorName} (@${c.auditorUsername}), dev de niveau Expert sur Baobab Dev.`,
    `Projet audité : « ${c.projectTitle} », dépôt ${c.repoUrl}, audit n° ${c.auditId.slice(0, 8).toUpperCase()}, échéance le ${date(c.deadline)}.`,
  ];
}

export function ndaClauses(c: NdaContext): { title: string; body: string }[] {
  return [
    {
      title: "Article 1 – Objet",
      body: `Le présent accord encadre l'accès de l'Auditeur au code source, à la documentation et aux échanges liés au projet « ${c.projectTitle} », dans le seul but de réaliser l'audit de dette technique demandé par le Porteur sur Baobab Dev.`,
    },
    {
      title: "Article 2 – Informations confidentielles",
      body: "Sont confidentiels : le code source et son historique, les secrets, clés et données qu'il contient, l'architecture, les constats de l'audit (y compris l'analyse automatique), les échanges entre les parties et toute information sur l'activité, les clients ou la levée de fonds du Porteur.",
    },
    {
      title: "Article 3 – Engagements de l'Auditeur",
      body: "L'Auditeur s'engage à : n'utiliser ces informations que pour l'audit ; ne pas les divulguer, publier, copier ou réutiliser, même partiellement, dans un autre projet ; ne pas les transmettre à une IA ou un service tiers qui les conserverait ; signaler sans délai toute fuite ; garder un ton respectueux et constructif dans ses constats.",
    },
    {
      title: "Article 4 – Exceptions",
      body: "Ne sont pas confidentielles les informations déjà publiques sans faute de l'Auditeur, celles qu'il connaissait avant l'audit et peut le démontrer, et celles dont la divulgation est exigée par la loi ou une décision de justice, le Porteur en étant alors averti.",
    },
    {
      title: "Article 5 – Durée",
      body: "Les obligations de confidentialité prennent effet à la signature et restent en vigueur deux (2) ans après la clôture de l'audit. Le certificat (score et synthèse) reste partageable par le Porteur seul.",
    },
    {
      title: "Article 6 – Restitution et suppression",
      body: "À la clôture de l'audit, l'Auditeur supprime toute copie locale du code et des documents reçus, et quitte les accès qui lui ont été ouverts (dépôt privé, outils).",
    },
    {
      title: "Article 7 – Manquements",
      body: "Tout manquement entraîne la perte de la rémunération de l'audit, l'exclusion de Code Forensic et une sanction de réputation sur Baobab Dev, sans préjudice des dommages et intérêts que le Porteur peut réclamer.",
    },
    {
      title: "Article 8 – Preuve et droit applicable",
      body: "Les parties reconnaissent la valeur de la signature électronique apposée sur la plateforme (nom saisi, horodatage et empreinte SHA-256 du document). Le présent accord est régi par le droit de l'État du Porteur et, à défaut, par les Actes uniformes OHADA. Tout différend fait d'abord l'objet d'une médiation amiable par Baobab Dev.",
    },
  ];
}

export const ndaDate = date;
