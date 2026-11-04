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
    case "mention":
      return { id: n.id, title: `@${p.from} t'a mentionné·e dans # ${p.title}`, detail: String(p.excerpt), href: `/discussions/${p.conversation_id}` };
    default:
      return null;
  }
}

