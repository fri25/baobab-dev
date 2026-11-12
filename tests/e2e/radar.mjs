// Radar d'opportunités : correspondances, alertes, confidentialité, collecte RSS avec extraction, réponses
import { createRequire } from "node:module";
import http from "node:http";
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

const [aicha, koffi, moussa, fatou, modo, mairie] = await Promise.all(["aicha", "koffi", "moussa", "fatou", "modo", "mairie"].map(login));
const COTONOU = "a2000000-0000-4000-8000-000000000001";
const SANTE = "a2000000-0000-4000-8000-000000000002";

// Pages et score personnel
const list = await page("/radar", aicha.cookie, "Paiement des taxes de marché");
ok("l'opportunité la plus proche remonte en premier pour Aïcha", list.indexOf("Paiement des taxes") < list.indexOf("Boutique en ligne"));
await page(`/radar/${COTONOU}`, aicha.cookie, "Correspondance avec");
await page(`/radar/${COTONOU}`, mairie.cookie, "Talents correspondants");
await page("/radar/publier", mairie.cookie, "Analyser le besoin");

// Alertes : au-dessus de 50 seulement
const { data: aNotif } = await admin.from("notifications").select("payload").eq("user_id", aicha.id).eq("kind", "opportunity_match");
ok("Aïcha (67/100) est alertée", aNotif?.some((n) => n.payload.opportunity_id === COTONOU));
const { data: kNotif } = await admin.from("notifications").select("id").eq("user_id", koffi.id).eq("kind", "opportunity_match");
ok("Koffi (49/100) n'est pas alerté", kNotif?.length === 0);
const { data: fNotif } = await admin.from("notifications").select("payload").eq("user_id", fatou.id).eq("kind", "opportunity_match");
ok("Fatou alertée pour l'appli santé (profil et Squad Flutter)", fNotif?.some((n) => n.payload.opportunity_id === SANTE));

// Confidentialité des correspondances
const { data: spy } = await moussa.c.from("opportunity_matches").select("target_id").eq("opportunity_id", COTONOU).eq("target_id", aicha.id);
ok("RLS : un dev ne voit pas les scores des autres", spy?.length === 0);
const { data: orgView } = await mairie.c.from("opportunity_matches").select("target_id").eq("opportunity_id", COTONOU);
ok("l'organisation voit les talents de son opportunité", (orgView?.length ?? 0) >= 3);
const { error: eForge } = await moussa.c.from("opportunities").insert({
  source: "collectee", publisher_id: moussa.id, organization_name: "x", title: "x", raw_text: "x", need: "x", status: "open",
});
ok("impossible de publier une opportunité « collectée »", !!eForge);
const { data: draft, error: eDraft } = await mairie.c
  .from("opportunities")
  .insert({ source: "publiee", publisher_id: mairie.id, organization_name: "Mairie de Cotonou", title: "Brouillon interne", raw_text: "Texte du brouillon interne", need: "Brouillon", status: "draft" })
  .select("id")
  .single();
ok("une organisation enregistre un brouillon", !eDraft, eDraft?.message);
const { data: seen } = await aicha.c.from("opportunities").select("id").eq("id", draft.id);
ok("les brouillons restent privés", seen?.length === 0);

// Réponses
const { error: eShort } = await aicha.c.rpc("respond_opportunity", { p_opportunity: COTONOU, p_message: "Je suis dispo", p_budget: null, p_squad: null });
ok("une réponse doit être développée", !!eShort);
const { error: eResp } = await aicha.c.rpc("respond_opportunity", {
  p_opportunity: COTONOU, p_message: "J'ai intégré FedaPay et l'USSD pour Tontine Pay à Cotonou. Je propose une V1 en 6 semaines.", p_budget: 9000000, p_squad: null,
});
ok("Aïcha répond à la mairie", !eResp, eResp?.message);
const { error: eTwice } = await aicha.c.rpc("respond_opportunity", { p_opportunity: COTONOU, p_message: "Deuxième réponse identique pour tester.", p_budget: null, p_squad: null });
ok("une seule réponse par dev", !!eTwice);
const { data: zem } = await admin.from("squads").select("id").eq("name", "Squad Zem Partage").single();
const { error: eNotOwner } = await moussa.c.rpc("respond_opportunity", { p_opportunity: SANTE, p_message: "Réponse au nom d'une Squad qui n'est pas à moi.", p_budget: null, p_squad: zem.id });
ok("seul le porteur répond au nom d'une Squad", !!eNotOwner);
const { error: eSquad } = await fatou.c.rpc("respond_opportunity", {
  p_opportunity: SANTE, p_message: "Notre Squad construit déjà Zem Partage en mode hors ligne avec Hive : on peut réutiliser la synchro.", p_budget: 5500000, p_squad: zem.id,
});
ok("Fatou répond au nom de sa Squad", !eSquad, eSquad?.message);
const { data: mResp } = await admin.from("notifications").select("id").eq("user_id", mairie.id).eq("kind", "opportunity_response");
ok("la mairie est prévenue de la réponse", mResp?.length === 1);
const { data: spyResp } = await moussa.c.from("opportunity_responses").select("id").eq("opportunity_id", COTONOU);
ok("RLS : les réponses des autres restent privées", spyResp?.length === 0);
const { data: resp } = await admin.from("opportunity_responses").select("id").eq("responder_id", aicha.id).single();
const { error: eNotOrg } = await aicha.c.rpc("set_response_status", { p_response: resp.id, p_status: "accepted" });
ok("seule l'organisation retient une réponse", !!eNotOrg);
await mairie.c.rpc("set_response_status", { p_response: resp.id, p_status: "accepted" });
const { data: closed } = await admin.from("opportunities").select("status").eq("id", COTONOU).single();
ok("réponse retenue : opportunité close", closed.status === "closed");
const { data: aDecision } = await admin.from("notifications").select("payload").eq("user_id", aicha.id).eq("kind", "opportunity_response_status");
ok("Aïcha apprend qu'elle est retenue", aDecision?.[0]?.payload.status === "accepted");

// Collecte : flux RSS local, filtre numérique, extraction par règles, déduplication, alertes
const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Appels d'offres</title>
<item><title>Digitalisation de la collecte des cotisations des tontines</title><link>http://localhost:4599/ao/1</link>
<description><![CDATA[Le Groupement des femmes commerçantes de Dakar recrute un prestataire pour une application de cotisation par Mobile Money et USSD.
Budget : 5 000 000 FCFA. Date limite de dépôt : 20/12/2026.]]></description></item>
<item><title>Fourniture de 500 sacs de riz</title><link>http://localhost:4599/ao/2</link><description>Livraison à Thiès avant fin décembre.</description></item>
</channel></rss>`;
const server = http.createServer((_q, r) => {
  r.writeHead(200, { "Content-Type": "application/rss+xml" });
  r.end(rss);
});
await new Promise((resolve) => server.listen(4599, resolve));
const { error: eSrcUser } = await aicha.c.from("radar_sources").insert({ name: "x", url: "http://localhost:4599/x" });
ok("seule la modération ajoute des sources", !!eSrcUser);
const { error: eSrc } = await modo.c.from("radar_sources").insert({ name: "Portail des marchés (test)", url: "http://localhost:4599/flux.rss", country: "Sénégal" });
ok("la modération ajoute une source RSS", !eSrc, eSrc?.message);
const cron = await (await fetch(`${APP}/api/cron`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })).json();
ok("collecte : une annonce numérique retenue, l'autre ignorée", cron.radar?.added === 1, JSON.stringify(cron.radar));
const { data: collected } = await admin.from("opportunities").select("*").eq("source_url", "http://localhost:4599/ao/1").single();
ok("extraction : technologies", collected?.technologies.includes("Mobile Money") && collected.technologies.includes("USSD"), collected?.technologies.join(", "));
ok("extraction : budget 5 000 000 FCFA", collected?.budget_min === 5000000 && collected.budget_max === 5000000, `${collected?.budget_min}`);
ok("extraction : date limite", collected?.deadline === "2026-12-20", collected?.deadline);
ok("extraction : ville et pays", collected?.city === "Dakar" && collected.country === "Sénégal", `${collected?.city}, ${collected?.country}`);
ok("collecte : l'annonce attend la validation de l'administration", collected?.status === "pending", collected?.status);
const { data: hidden } = await moussa.c.from("opportunities").select("id").eq("id", collected.id);
ok("une annonce non validée reste invisible du public", hidden?.length === 0);
const { data: early } = await admin.from("notifications").select("payload").eq("user_id", moussa.id).eq("kind", "opportunity_match");
ok("aucune alerte avant validation", !early?.some((n) => n.payload.opportunity_id === collected?.id));
const { error: eSelfOpen } = await mairie.c.from("opportunities").update({ status: "open" }).eq("id", draft.id);
ok("une organisation ne peut pas publier sans validation", !!eSelfOpen);
const { error: eNotModo } = await aicha.c.rpc("review_opportunity", { p_opportunity: collected.id, p_approve: true, p_note: "" });
ok("seule l'administration valide", !!eNotModo);
const { error: eReview } = await modo.c.rpc("review_opportunity", { p_opportunity: collected.id, p_approve: true, p_note: "" });
ok("l'administration valide l'annonce", !eReview, eReview?.message);
// Le serveur calcule alors les correspondances et envoie les alertes (matchAndAlert)
await admin.rpc("compute_opportunity_matches", { p_opportunity: collected.id });
await admin.rpc("notify_opportunity_matches", { p_opportunity: collected.id });
const { data: mAlert } = await admin.from("notifications").select("payload").eq("user_id", moussa.id).eq("kind", "opportunity_match");
ok("Moussa (Mobile Money, USSD, Dakar) est alerté après validation", mAlert?.some((n) => n.payload.opportunity_id === collected?.id));
const again = await (await fetch(`${APP}/api/cron`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })).json();
ok("pas de doublon à la collecte suivante", again.radar?.added === 0);
server.close();

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
