// Espace recruteurs : abonnement, recherche de profils vérifiés, confidentialité, propositions consenties, quota, expiration
import { createRequire } from "node:module";
import fs from "node:fs";

const appDir = process.argv[2] ?? process.cwd();
const require = createRequire(`${appDir}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const env = Object.fromEntries(
  fs.readFileSync(`${appDir}/.env.local`, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const APP = "http://localhost:3000";
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failures = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};
async function login(user) {
  const c = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: `${user}@baobab.dev`, password: "baobab2026" });
  if (error) throw new Error(`${user}: ${error.message}`);
  const ref = new URL(URL_).hostname.split(".")[0];
  return { c, id: data.user.id, cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}` };
}
async function page(path, cookie, expect, absent) {
  const res = await fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  const found = expect ? body.includes(expect) : true;
  const clean = absent ? !body.includes(absent) : true;
  ok(`page ${path}`, res.status === 200 && found && clean, `${res.status}${expect && !found ? `, « ${expect} » absent` : ""}${!clean ? `, « ${absent} » présent` : ""}`);
  return body;
}
const balance = async (id) => (await admin.from("wallets").select("balance").eq("user_id", id).single()).data.balance;

const [aicha, koffi, moussa, fatou, ibrahim, mairie] = await Promise.all(["aicha", "koffi", "moussa", "fatou", "ibrahim", "mairie"].map(login));

// Pages
await page("/recruteurs", null, "Se connecter pour s&#x27;abonner", "Trouver des talents");
await page("/recruteurs", moussa.cookie, "profils vérifiés");
const search = await page("/recruteurs", mairie.cookie, "Trouver des talents vérifiés");
ok("la recherche affiche Aïcha vérifiée", search.includes("Aïcha Dossou") && search.includes("✓ Vérifié"));
ok("Ibrahim (invisible) n'apparaît pas", !search.includes("Ibrahim"));
ok("le compte de modération n'apparaît pas", !search.includes("Équipe Baobab"));
await page("/recruteurs?skills=Flutter", mairie.cookie, "Fatou Agbodjan", "Koffi Kouassi");
await page("/recruteurs/talents/aicha", mairie.cookie, "Preuves vérifiables");
await page("/recruteurs/selection", mairie.cookie, "Aïcha Dossou");
await page("/propositions", koffi.cookie, "Audit de la plateforme de paiement des taxes");
await page("/u/aicha", null, "✓ Profil vérifié");
await page("/parametres", aicha.cookie, "recruteurs abonnés");
const notAllowed = await fetch(`${APP}/recruteurs/talents/aicha`, { headers: { cookie: moussa.cookie }, redirect: "manual" });
ok("fiche recruteur refusée sans abonnement", notAllowed.status === 307 || notAllowed.status === 303, String(notAllowed.status));

// Recherche réservée aux abonnés
const { error: eSearch } = await moussa.c.rpc("search_talents");
ok("recherche refusée sans abonnement", eSearch?.message.includes("Abonnement recruteur requis"));
const { data: pool } = await moussa.c.rpc("talent_pool_stats");
ok("aperçu public : 4 profils visibles dont 2 vérifiés", pool.visible === 4 && pool.verified === 2, JSON.stringify({ v: pool.visible, ok: pool.verified }));
const { error: eDirect } = await moussa.c.from("recruiter_subscriptions").insert({ recruiter_id: moussa.id, company: "Fausse", ends_at: "2030-01-01", amount: 0, contacts_quota: 999 });
ok("impossible de s'offrir un abonnement en écrivant la table", !!eDirect);

// Filtres et score
const { data: laravel } = await mairie.c.rpc("search_talents", { p_skills: ["laravel"] });
ok("Laravel : Koffi et Aïcha", laravel.map((t) => t.username).sort().join(",") === "aicha,koffi", laravel.map((t) => t.username).join(","));
ok("Aïcha déjà présélectionnée, Koffi déjà contacté", laravel.find((t) => t.username === "aicha").shortlisted && laravel.find((t) => t.username === "koffi").contacted === "pending");
const { data: verified } = await mairie.c.rpc("search_talents", { p_verified_only: true });
ok("filtre vérifiés : Aïcha et Moussa", verified.map((t) => t.username).sort().join(",") === "aicha,moussa", verified.map((t) => t.username).join(","));
const { data: senegal } = await mairie.c.rpc("search_talents", { p_country: "Sénégal" });
ok("filtre pays", senegal.length === 1 && senegal[0].username === "moussa");
const { data: stage } = await mairie.c.rpc("search_talents", { p_open_to: "stage" });
ok("filtre type de contrat (stage) : Fatou seule (Ibrahim masqué)", stage.map((t) => t.username).join(",") === "fatou");
const { data: expert } = await mairie.c.rpc("search_talents", { p_min_xp: 2000 });
ok("filtre niveau Expert : Koffi", expert.map((t) => t.username).join(",") === "koffi", expert.map((t) => `${t.username}:${t.xp}`).join(","));
const { data: kw } = await mairie.c.rpc("search_talents", { p_query: "ussd" });
ok("mots-clés dans la bio ou les compétences", kw.some((t) => t.username === "moussa"));
ok("scores bornés à 100", (await mairie.c.rpc("search_talents")).data.every((t) => t.score >= 0 && t.score <= 100));

// Vues de profil : agrégées, une par jour
await mairie.c.rpc("recruiter_view_profile", { p_dev: aicha.id });
await mairie.c.rpc("recruiter_view_profile", { p_dev: aicha.id });
const { count: views } = await admin.from("recruiter_profile_views").select("id", { count: "exact", head: true }).eq("dev_id", aicha.id);
ok("une seule vue par jour et par recruteur", views === 1, String(views));
const { data: myViews } = await aicha.c.rpc("my_recruiter_views");
ok("Aïcha voit qu'un recruteur (Mairie de Cotonou) l'a consultée", myViews.views_30d === 1 && myViews.companies[0] === "Mairie de Cotonou");
const { data: rawViews } = await aicha.c.from("recruiter_profile_views").select("recruiter_id");
ok("RLS : le dev ne lit pas le détail des consultations", rawViews?.length === 0);
const { error: eHidden } = await mairie.c.rpc("recruiter_view_profile", { p_dev: ibrahim.id });
ok("fiche d'un dev masqué refusée", !!eHidden);

// Abonnement : Moussa s'abonne puis prolonge
const before = await balance(moussa.id);
const { error: eSub } = await moussa.c.rpc("subscribe_recruiter", { p_company: "Wave Tech" });
ok("Moussa s'abonne (25 000 FCFA)", !eSub && (await balance(moussa.id)) === before - 25000, eSub?.message);
await moussa.c.rpc("subscribe_recruiter", { p_company: "Wave Tech" });
await moussa.c.rpc("subscribe_recruiter", { p_company: "Wave Tech" });
const { data: subs } = await admin.from("recruiter_subscriptions").select("starts_at, ends_at").eq("recruiter_id", moussa.id).order("starts_at");
ok("périodes enchaînées sans chevauchement", subs.length === 3 && subs[1].starts_at === subs[0].ends_at && subs[2].starts_at === subs[1].ends_at);
const { data: st } = await moussa.c.rpc("my_recruiter_status");
const days = Math.round((new Date(st.ends_at) - Date.now()) / 86400000);
ok("les prolongations s'ajoutent à la fin (90 jours)", days === 90, String(days));
const { data: self } = await moussa.c.rpc("search_talents");
ok("on ne se trouve pas soi-même", !self.some((t) => t.username === "moussa"));

// Propositions consenties
const { error: eSelf } = await moussa.c.rpc("send_recruiter_contact", { p_dev: moussa.id, p_offer_kind: "cdi", p_title: "Moi", p_message: "Un message suffisamment long pour passer." });
ok("impossible de se contacter soi-même", !!eSelf);
const { error: eShort } = await moussa.c.rpc("send_recruiter_contact", { p_dev: fatou.id, p_offer_kind: "stage", p_title: "Stage", p_message: "Trop court" });
ok("message trop court refusé", !!eShort);
const { data: cFatou, error: eFatou } = await moussa.c.rpc("send_recruiter_contact", {
  p_dev: fatou.id, p_offer_kind: "stage", p_title: "Stage Flutter 6 mois", p_message: "Bonjour Fatou, nous cherchons une stagiaire Flutter pour notre appli de transfert.", p_budget: "150 000 FCFA / mois",
});
ok("proposition envoyée à Fatou", !eFatou && !!cFatou, eFatou?.message);
const { error: eDup } = await moussa.c.rpc("send_recruiter_contact", { p_dev: fatou.id, p_offer_kind: "stage", p_title: "Relance", p_message: "Une relance pendant que la première attend." });
ok("une seule proposition en attente par dev", eDup?.message.includes("déjà en attente"));
const { data: nFatou } = await admin.from("notifications").select("payload").eq("user_id", fatou.id).eq("kind", "recruiter_contact");
ok("Fatou est notifiée", nFatou?.some((n) => n.payload.contact_id === cFatou && n.payload.company === "Wave Tech"));
const { data: convBefore } = await admin.from("conversation_members").select("conversation_id").eq("user_id", moussa.id);
const { error: eSpy } = await aicha.c.rpc("respond_recruiter_contact", { p_contact: cFatou, p_accept: true });
ok("seule la destinataire peut répondre", !!eSpy);
const { data: peek } = await aicha.c.from("recruiter_contacts").select("id").eq("id", cFatou);
ok("RLS : un tiers ne voit pas la proposition", peek?.length === 0);
const { error: eForge } = await moussa.c.from("recruiter_contacts").update({ status: "accepted" }).eq("id", cFatou);
const { data: still } = await admin.from("recruiter_contacts").select("status").eq("id", cFatou).single();
ok("le recruteur ne peut pas forcer l'acceptation", still.status === "pending", eForge?.message);

const { data: conv, error: eAcc } = await fatou.c.rpc("respond_recruiter_contact", { p_contact: cFatou, p_accept: true });
ok("Fatou accepte : conversation ouverte", !eAcc && !!conv, eAcc?.message);
const { data: firstMsg } = await admin.from("messages").select("author_id, body").eq("conversation_id", conv).order("id").limit(1).single();
ok("le message du recruteur ouvre la conversation", firstMsg?.author_id === moussa.id && firstMsg.body.includes("Wave Tech · Stage Flutter 6 mois") && firstMsg.body.includes("150 000"));
const { error: eReply } = await fatou.c.from("messages").insert({ conversation_id: conv, author_id: fatou.id, body: "Avec plaisir, parlons-en !" });
ok("Fatou peut répondre dans la conversation", !eReply, eReply?.message);
const { data: nMoussa } = await admin.from("notifications").select("payload").eq("user_id", moussa.id).eq("kind", "recruiter_contact_answer");
ok("Moussa est notifié de l'acceptation", nMoussa?.some((n) => n.payload.accepted && n.payload.conversation_id === conv));
const { error: eTwice } = await fatou.c.rpc("respond_recruiter_contact", { p_contact: cFatou, p_accept: false });
ok("une proposition ne se traite qu'une fois", !!eTwice);
ok("aucune conversation n'existait avant l'acceptation", !(convBefore ?? []).some((c) => c.conversation_id === conv));

// Refus : pas de relance pendant 30 jours
const { data: cKoffi } = await admin.from("recruiter_contacts").select("id").eq("dev_id", koffi.id).eq("status", "pending").single();
const { error: eDec } = await koffi.c.rpc("respond_recruiter_contact", { p_contact: cKoffi.id, p_accept: false, p_reason: "Je suis pris jusqu'en février." });
ok("Koffi décline avec une raison", !eDec, eDec?.message);
const { data: dec } = await mairie.c.from("recruiter_contacts").select("status, decline_reason, conversation_id").eq("id", cKoffi.id).single();
ok("le recruteur voit le refus et la raison, sans conversation", dec.status === "declined" && dec.decline_reason.includes("février") && !dec.conversation_id);
const { error: eRelance } = await mairie.c.rpc("send_recruiter_contact", { p_dev: koffi.id, p_offer_kind: "mission", p_title: "Relance", p_message: "Nous revenons vers vous pour la mission." });
ok("relance refusée pendant 30 jours", eRelance?.message.includes("30 jours"));
await page("/recruteurs/selection", mairie.cookie, "Je suis pris jusqu&#x27;en février.");

// Blocage
await admin.from("user_blocks").insert({ blocker_id: aicha.id, blocked_id: moussa.id });
const { data: afterBlock } = await moussa.c.rpc("search_talents");
ok("un dev qui bloque un recruteur disparaît de sa recherche", !afterBlock.some((t) => t.username === "aicha"));
const { error: eBlocked } = await moussa.c.rpc("send_recruiter_contact", { p_dev: aicha.id, p_offer_kind: "cdi", p_title: "CDI", p_message: "Une offre qui ne devrait pas passer." });
ok("et ne peut plus recevoir ses propositions", !!eBlocked);

// Masquage par le dev
await admin.from("profiles").update({ recruiter_visible: false }).eq("id", fatou.id);
const { error: eHiddenContact } = await moussa.c.rpc("send_recruiter_contact", { p_dev: fatou.id, p_offer_kind: "cdi", p_title: "CDI", p_message: "Une offre pour un profil devenu masqué." });
ok("un dev masqué ne reçoit plus de propositions", !!eHiddenContact);
await admin.from("profiles").update({ recruiter_visible: true }).eq("id", fatou.id);
const { error: eCols } = await koffi.c.from("profiles").update({ recruiter_visible: false, open_to: ["cdi"] }).eq("id", koffi.id);
ok("le dev règle lui-même sa visibilité et ses contrats", !eCols, eCols?.message);
const { error: eBadOpen } = await koffi.c.from("profiles").update({ open_to: ["esclavage"] }).eq("id", koffi.id);
ok("type de contrat inconnu refusé", !!eBadOpen);

// Quota
const sub = (await admin.from("recruiter_subscriptions").select("id").eq("recruiter_id", moussa.id).order("starts_at").limit(1).single()).data;
await admin.from("recruiter_subscriptions").update({ contacts_quota: 1 }).eq("id", sub.id);
const { error: eQuota } = await moussa.c.rpc("send_recruiter_contact", { p_dev: fatou.id, p_offer_kind: "mission", p_title: "Mission", p_message: "Une mission pour tester le quota de contacts." });
ok("quota de prises de contact atteint", eQuota?.message.includes("Quota"), eQuota?.message);

// Expiration (tâche quotidienne)
const { data: cOld } = await mairie.c.rpc("send_recruiter_contact", { p_dev: moussa.id, p_offer_kind: "cdi", p_title: "Lead dev", p_message: "Un poste de lead dev à la mairie de Cotonou." });
await admin.from("recruiter_contacts").update({ created_at: new Date(Date.now() - 15 * 86400000).toISOString() }).eq("id", cOld);
const cron = await (await fetch(`${APP}/api/cron`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })).json();
ok("cron : la proposition sans réponse expire", cron.daily?.expired_recruiter_contacts === 1 || cron.expired_recruiter_contacts === 1 || JSON.stringify(cron).includes('"expired_recruiter_contacts":1'), JSON.stringify(cron).slice(0, 200));
const { data: exp } = await admin.from("recruiter_contacts").select("status").eq("id", cOld).single();
ok("statut expiré", exp.status === "expired");

// Abonnement expiré : plus d'accès
await admin.from("recruiter_subscriptions").update({ starts_at: "2026-01-01", ends_at: "2026-02-01" }).eq("recruiter_id", mairie.id);
const { error: eExpired } = await mairie.c.rpc("search_talents");
ok("abonnement échu : recherche refusée", eExpired?.message.includes("Abonnement"));
await page("/recruteurs", mairie.cookie, "Mairie de Cotonou", "Trouver des talents");

// Journal financier
const { data: tx } = await admin.from("transactions").select("amount").eq("kind", "recruiter_subscription").is("user_id", null);
ok("revenus plateforme : 4 abonnements (100 000 FCFA)", tx.reduce((n, t) => n + Number(t.amount), 0) === 100000, String(tx.length));
await page("/portefeuille", moussa.cookie, "Abonnement recruteurs (30 jours)");

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
