export const AUDIT_NDA_VERSION = "nda-v1";

export const AUDIT_NDA_CLAUSES = [
  {
    title: "Objet et usage",
    text: "Les informations non publiques partagées pour l’audit (code, architecture, contexte, accès et constats) sont utilisées uniquement pour réaliser cet audit.",
  },
  {
    title: "Confidentialité",
    text: "Chaque partie protège ces informations, limite leur accès aux personnes participant à l’audit et ne les publie ni ne les transmet à un tiers sans autorisation.",
  },
  {
    title: "Exceptions",
    text: "Ces obligations ne couvrent pas les informations déjà publiques sans violation du présent accord, obtenues licitement sans restriction, développées indépendamment ou dont la divulgation est imposée par la loi. Lorsque la loi le permet, l’autre partie en est informée au préalable.",
  },
  {
    title: "Sécurité et incident",
    text: "Chaque partie prend des mesures raisonnables pour protéger les informations et avertit l’autre partie dès que possible en cas d’accès ou de divulgation non autorisés. Les données de production et secrets d’accès ne doivent pas être transmis s’ils ne sont pas indispensables.",
  },
  {
    title: "Fin de l’audit",
    text: "À la clôture, l’auditeur supprime les copies locales dans un délai maximal de 30 jours, sauf conservation imposée par la loi. Les engagements de confidentialité s’appliquent pendant l’audit et deux ans après sa clôture; les secrets d’affaires restent protégés tant qu’ils ne sont pas publics licitement.",
  },
  {
    title: "Droits et portée",
    text: "L’accès au dépôt ne transfère aucun droit de propriété intellectuelle. L’audit fournit des observations techniques et ne garantit ni l’absence de vulnérabilité ni un résultat commercial.",
  },
] as const;

export const AUDIT_NDA_NOTICE =
  "Proposition provisoire à faire valider juridiquement. Cette acceptation est horodatée dans Baobab Dev; elle ne constitue pas une signature électronique certifiée. La génération et l’envoi d’un PDF signé seront ajoutés après le choix d’un prestataire de signature.";
