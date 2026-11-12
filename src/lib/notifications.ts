export type Notification = { id: number; kind: string; payload: Record<string, unknown> };
export type Toast = { id: number; title: string; detail?: string; href?: string; badge?: boolean };

const BADGE_NAMES: Record<string, string> = {
  sage_village: "Sage du Village",
  batisseur: "Bâtisseur",
  esprit_equipe: "Esprit d'équipe",
  chasseur_primes: "Chasseur de primes",
  mecene_code: "Mécène du code",
  voix_griot: "Voix du Griot",
  pont_nations: "Pont entre nations",
};
const TIERS: Record<string, string> = { bronze: "Bronze", argent: "Argent", or: "Or" };

export function toToast(n: Notification): Toast | null {
  const p = n.payload;
  switch (n.kind) {
    case "badge_unlocked": {
      const code = String(p.badge);
      const tier = code.split("_").pop()!;
      return { id: n.id, title: `Badge débloqué : ${BADGE_NAMES[code.replace(`_${tier}`, "")] ?? code}`, detail: TIERS[tier], badge: true };
    }
    case "griot_citation":
      return { id: n.id, title: "Le Griot vient de citer ta réponse", detail: "+5 XP", href: `/questions` };
    case "bounty_paid":
      return { id: n.id, title: "Prime versée sur ton portefeuille", detail: `${Number(p.amount).toLocaleString("fr-FR")} FCFA`, href: "/portefeuille" };
    case "new_answer":
      return { id: n.id, title: "Nouvelle réponse à ta question", href: `/questions/${p.question_id}` };
    case "question_for_you":
      return { id: n.id, title: `Question ${p.skill} pour toi`, detail: String(p.title), href: `/questions/${p.question_id}` };
    case "griot_review":
      return {
        id: n.id,
        title: `Avis d’expert demandé · ${p.skill}`,
        detail: String(p.title),
        href: `/discussions/${p.conversation_id}`,
      };
    case "bounty_contribution":
      return { id: n.id, title: "Ton ticket a été abondé", detail: `+${Number(p.amount).toLocaleString("fr-FR")} FCFA`, href: `/bourse/${p.bounty_id}` };
    case "squad_application":
      return { id: n.id, title: `Nouvelle candidature : ${p.name}`, href: `/squads/${p.squad_id}` };
    case "squad_invitation":
      return { id: n.id, title: `Invitation dans ${p.name}`, href: `/squads/${p.squad_id}` };
    case "challenge_ranked":
      return { id: n.id, title: `Podium du défi : ${p.rank}${p.rank === 1 ? "re" : "e"} place`, href: `/defis/${p.challenge_id}` };
    case "stack_down":
      return { id: n.id, title: `Panne détectée : ${p.name}`, detail: "Un outil que tu utilises en production ne répond plus.", href: "/stack" };
    case "bounty_refunded":
      return { id: n.id, title: "Ticket remboursé", detail: `+${Number(p.amount).toLocaleString("fr-FR")} FCFA`, href: `/bourse/${p.bounty_id}` };
    case "dispute_arbiter":
      return { id: n.id, title: "Tu es tiré·e au sort pour arbitrer un litige", href: `/bourse/${p.bounty_id}` };
    case "direct_message":
      return { id: n.id, title: `Message de @${p.from}`, detail: String(p.excerpt), href: `/discussions/${p.conversation_id}` };
    case "topic_invitation":
      return {
        id: n.id,
        title: `@${p.from} t’invite dans # ${p.title}`,
        href: `/discussions/${p.conversation_id}`,
      };
    case "mention":
      return { id: n.id, title: `@${p.from} t'a mentionné·e dans # ${p.title}`, detail: String(p.excerpt), href: `/discussions/${p.conversation_id}` };
    case "clone_flagged":
      return { id: n.id, title: "Une réponse de ton clone a été signalée", detail: String(p.question), href: "/clones/mon-clone" };
    case "clone_suspended":
      return { id: n.id, title: "Ton clone est suspendu", detail: `Note moyenne : ${p.rating}`, href: "/clones/mon-clone" };
    case "audit_auditor_joined":
      return { id: n.id, title: "Un auditeur a rejoint ton audit", detail: String(p.title), href: `/forensic/${p.audit_id}` };
    case "audit_contest":
      return { id: n.id, title: "Constat contesté : ton vote est attendu", detail: String(p.title), href: `/forensic/${p.audit_id}` };
    case "audit_paid":
      return { id: n.id, title: "Audit clôturé : tu es payé·e", detail: `+${Number(p.amount).toLocaleString("fr-FR")} FCFA`, href: `/forensic/${p.audit_id}` };
    case "audit_refunded":
      return { id: n.id, title: "Audit expiré sans auditeur : forfait remboursé", href: `/forensic/${p.audit_id}` };
    case "project_abandoned":
      return { id: n.id, title: `${p.name} semble à l'arrêt`, detail: "Relance-le avec une Squad, cède-le ou archive-le.", href: `/showroom/${p.slug}` };
    case "project_adopted":
      return { id: n.id, title: `${p.by} reprend ${p.name}`, detail: "Tu restes crédité·e comme fondateur·rice.", href: `/showroom/${p.slug}` };
    case "opportunity_match":
      return { id: n.id, title: `🎯 ${p.organization_name ?? p.organization} cherche ton profil`, detail: `${p.title} · correspondance ${p.score}/100`, href: `/radar/${p.opportunity_id}` };
    case "opportunity_response":
      return { id: n.id, title: `Nouvelle réponse de ${p.from}`, detail: String(p.title), href: `/radar/${p.opportunity_id}` };
    case "opportunity_response_status": {
      const label: Record<string, string> = { shortlisted: "Présélectionné·e", accepted: "Retenu·e !", declined: "Non retenu·e" };
      return { id: n.id, title: `${label[String(p.status)] ?? p.status} : ${p.title}`, href: `/radar/${p.opportunity_id}` };
    }
    case "infra_paused": {
      const why: Record<string, string> = { solde: "solde épuisé", budget: "plafond mensuel atteint", abus_sms: "envoi massif de SMS" };
      return { id: n.id, title: "Ressources de la Centrale en pause", detail: why[String(p.reason)] ?? String(p.reason), href: "/centrale" };
    }
    case "infra_budget":
      return { id: n.id, title: `Centrale : ${p.level} % de ton plafond mensuel`, detail: `${Number(p.spend).toLocaleString("fr-FR")} / ${Number(p.cap).toLocaleString("fr-FR")} FCFA`, href: "/centrale" };
    case "recruiter_contact":
      return { id: n.id, title: `${p.company} te propose une opportunité`, detail: String(p.title), href: "/propositions" };
    case "recruiter_contact_answer":
      return p.accepted
        ? { id: n.id, title: `@${p.dev} a accepté ta proposition`, detail: String(p.title), href: `/discussions/${p.conversation_id}` }
        : { id: n.id, title: `@${p.dev} a décliné ta proposition`, detail: String(p.title), href: "/recruteurs/selection" };
    case "infra_credits":
      return { id: n.id, title: `+${Number(p.amount).toLocaleString("fr-FR")} FCFA de crédits d'infrastructure`, detail: String(p.reason), href: "/centrale" };
    default:
      return null;
  }
}
