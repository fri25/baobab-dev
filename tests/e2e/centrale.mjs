// Centrale d'achat : adhésion, catalogue, ressources, facturation au réel, crédits, plafonds, pause, SMS, IA, quotas, sécurité
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
async function page(path, cookie, expect, status = 200) {
  const res = await fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  const found = expect ? body.includes(expect) : true;
  ok(`page ${path}`, res.status === status && found, `${res.status}${expect && !found ? `, « ${expect} » absent` : ""}`);
}
const wallet = async (u) => (await admin.from("wallets").select("balance").eq("user_id", u.id).single()).data.balance;
const credits = async (u) => (await admin.from("infra_credits").select("balance").eq("user_id", u.id).maybeSingle()).data?.balance ?? 0;
const status = async (id) => (await admin.from("infra_resources").select("status, pause_reason").eq("id", id).single()).data;
const create = async (u, code, name, project = null, squad = null) =>
  u.c.rpc("create_infra_resource", { p_offer_code: code, p_name: name, p_project: project, p_squad: squad }).single();
const cron = async () => (await fetch(`${APP}/api/cron`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })).json();
const sms = (key, message = "Votre cotisation est reçue") =>
  fetch(`${APP}/api/centrale/sms`, { method: "POST", headers: { "x-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ to: "+22997000000", message }) });

const [aicha, koffi, moussa, fatou, ibrahim] = await Promise.all(["aicha", "koffi", "moussa", "fatou", "ibrahim"].map(login));

// Correctif de sécurité : XP et badges non attribuables à la main
const { error: eXp } = await moussa.c.rpc("add_points", { p_user: moussa.id, p_amount: 5000, p_reason: "triche" });
ok("sécurité : impossible de s'attribuer des XP", !!eXp, eXp?.message);
const { error: eBadge } = await moussa.c.rpc("award_badge", { p_user: moussa.id, p_code: "chasseur_primes_or" });
ok("sécurité : impossible de s'attribuer un badge", !!eBadge);

// Pages
await page("/centrale", koffi.cookie, "Consommé ce mois-ci");
await page("/centrale", moussa.cookie, "Adhérer à la coopérative");
await page("/centrale/ressources/a3000000-0000-4000-8000-000000000001", koffi.cookie, "api-wari-map");
await page("/centrale/ressources/a3000000-0000-4000-8000-000000000001", moussa.cookie, null, 404);
const { data: offers } = await admin.from("infra_offers").select("price, wholesale_price, public_price");
ok("catalogue : marge de 10 à 15 %, sous le prix public", offers.every((o) => o.price >= o.wholesale_price * 1.1 && o.price <= o.wholesale_price * 1.15 && o.price < o.public_price), `${offers.length} offres`);
const { error: eBadOffer } = await admin.from("infra_offers").insert({ code: "x", category: "calcul", name: "x", provider: "x", description: "x", unit: "heure", billing_mode: "horaire", wholesale_price: 10, price: 20, public_price: 30 });
ok("une marge de 100 % est refusée par la base", !!eBadOffer);

// Adhésion et clé SMS
const { error: eNotMember } = await moussa.c.rpc("create_infra_resource", { p_offer_code: "sms", p_name: "sms-test", p_project: null, p_squad: null });
ok("adhésion requise", !!eNotMember);
await moussa.c.rpc("join_centrale");
const { data: smsRes, error: eSms } = await create(moussa, "sms", "sms-tontine");
ok("création d'une passerelle SMS avec clé d'API", !eSms && smsRes?.api_key?.startsWith("bk_"), eSms?.message);
const { error: eHash } = await moussa.c.from("infra_resources").select("api_key_hash").eq("id", smsRes.resource_id);
ok("le hash de la clé n'est jamais lisible", !!eHash);
await page(`/centrale/ressources/${smsRes.resource_id}`, moussa.cookie, "Limite anti-spam");

const m0 = await wallet(moussa);
const r1 = await sms(smsRes.api_key);
const j1 = await r1.json();
ok("SMS facturé 20 FCFA", r1.ok && j1.cost_fcfa === 20 && (await wallet(moussa)) === m0 - 20, JSON.stringify(j1).slice(0, 80));
const r2 = await sms(smsRes.api_key, "x".repeat(200));
ok("un message de 200 caractères compte 2 SMS", (await r2.json()).segments === 2 && (await wallet(moussa)) === m0 - 60);
ok("clé invalide refusée", (await sms("bk_fausse")).status === 401);
const rIa = await fetch(`${APP}/api/centrale/ia/v1/messages`, { method: "POST", headers: { "x-api-key": smsRes.api_key, "Content-Type": "application/json" }, body: "{}" });
ok("une clé SMS n'ouvre pas le proxy d'IA", rIa.status === 401);

// Anti-spam SMS
await admin.from("app_settings").update({ value: 5 }).eq("key", "infra_sms_per_hour");
let blocked = null;
for (let i = 0; i < 6 && !blocked; i++) {
  const r = await sms(smsRes.api_key);
  if (r.status === 429) blocked = r.status;
}
ok("envoi massif de SMS : ressource suspendue", blocked === 429 && (await status(smsRes.resource_id)).pause_reason === "abus_sms");
const { error: eResume } = await moussa.c.rpc("set_infra_resource_status", { p_resource: smsRes.resource_id, p_status: "active" });
ok("une ressource suspendue pour spam ne redémarre pas seule", !!eResume, eResume?.message);
await admin.from("app_settings").update({ value: 100 }).eq("key", "infra_sms_per_hour");

// Crédits offerts d'abord, puis facturation horaire
const { error: eForeign } = await create(aicha, "vps-s", "mauvais-projet", (await admin.from("projects").select("id").eq("slug", "wari-map").single()).data.id);
ok("on n'héberge que ses propres projets", !!eForeign);
const tontine = (await admin.from("projects").select("id").eq("slug", "tontine-pay").single()).data.id;
const { data: vps } = await create(aicha, "vps-s", "api-tontine", tontine);
const [a0, c0] = [await wallet(aicha), await credits(aicha)];
await admin.from("infra_resources").update({ last_billed_at: new Date(Date.now() - 5.5 * 3600000).toISOString() }).eq("id", vps.resource_id);
const meter = await cron();
ok("facturation horaire : 5 h × 10 FCFA", meter.infra?.billed >= 1 && (await credits(aicha)) === c0 - 50, JSON.stringify(meter.infra));
ok("les crédits offerts sont utilisés avant le portefeuille", (await wallet(aicha)) === a0);

// Plafond mensuel : pause automatique, puis reprise après relèvement
await aicha.c.rpc("set_infra_budget", { p_cap: 500 });
await admin.from("infra_resources").update({ last_billed_at: new Date(Date.now() - 60 * 3600000).toISOString() }).eq("id", vps.resource_id);
await cron();
ok("plafond atteint : pause automatique", (await status(vps.resource_id)).pause_reason === "budget");
const { data: alerts } = await admin.from("notifications").select("payload").eq("user_id", aicha.id).eq("kind", "infra_budget");
ok("alerte de plafond envoyée", alerts?.some((a) => a.payload.level === 100));
const { error: eStill } = await aicha.c.rpc("set_infra_resource_status", { p_resource: vps.resource_id, p_status: "active" });
ok("impossible de reprendre au-dessus du plafond", !!eStill);
await aicha.c.rpc("set_infra_budget", { p_cap: 20000 });
const { error: eUp } = await aicha.c.rpc("set_infra_resource_status", { p_resource: vps.resource_id, p_status: "active" });
ok("plafond relevé : la ressource repart", !eUp && (await status(vps.resource_id)).status === "active", eUp?.message);

// Solde épuisé : pause plutôt que dette
await ibrahim.c.rpc("join_centrale");
const { data: iSms } = await create(ibrahim, "sms", "sms-ibrahim");
await admin.from("wallets").update({ balance: 5 }).eq("user_id", ibrahim.id);
const rPoor = await sms(iSms.api_key);
ok("solde insuffisant : SMS refusé, ressource en pause", rPoor.status === 402 && (await status(iSms.resource_id)).pause_reason === "solde");
ok("aucune dette créée", (await wallet(ibrahim)) === 5);

// Paiement unique (domaine) et quota
await fatou.c.rpc("join_centrale");
const f0 = await wallet(fatou);
const { error: eDom } = await create(fatou, "domaine", "zem-partage-com");
ok("domaine réglé à la réservation (9 000 FCFA)", !eDom && (await wallet(fatou)) === f0 - 9000, eDom?.message);
for (const n of ["a", "b", "c", "d"]) await create(fatou, "monitoring", `monitoring-${n}`);
const { error: eQuota } = await create(fatou, "monitoring", "monitoring-e");
ok("quota de 5 ressources par compte", !!eQuota, eQuota?.message);

// Crédits offerts aux projets de la semaine
const mod = await login("modo");
const zem = (await admin.from("projects").select("id").eq("slug", "zem-partage").single()).data.id;
const fc0 = await credits(fatou);
await mod.c.rpc("elect_project_of_week", { p_project_id: zem });
ok("projet de la semaine : 3 000 FCFA de crédits", (await credits(fatou)) === fc0 + 3000);

// Coopérative : vote et ristourne
const { data: prop } = await admin.from("infra_proposals").select("id").like("title", "Ajouter une passerelle%").single();
const { data: votes } = await koffi.c.rpc("vote_infra_proposal", { p_proposal: prop.id });
ok("un membre vote une proposition", votes === 1);
const { error: eVoteNM } = await (await login("mairie")).c.rpc("vote_infra_proposal", { p_proposal: prop.id });
ok("seuls les membres votent", !!eVoteNM);
const year = new Date().getFullYear();
const kc0 = await credits(koffi);
const { data: paid, error: eRebate } = await mod.c.rpc("distribute_infra_rebate", { p_year: year });
ok("ristourne annuelle versée en crédits", !eRebate && paid >= 1 && (await credits(koffi)) > kc0, eRebate?.message ?? `${paid} membre(s)`);
const { error: eTwice } = await mod.c.rpc("distribute_infra_rebate", { p_year: year });
ok("une seule ristourne par an", !!eTwice);

// Proxy d'IA
const { data: iaRes } = await create(aicha, "ia", "cle-ia");
const rProxy = await fetch(`${APP}/api/centrale/ia/v1/messages`, {
  method: "POST",
  headers: { "x-api-key": iaRes.api_key, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "claude-opus-5-5", max_tokens: 50, messages: [{ role: "user", content: "Dis bonjour en wolof." }] }),
});
if (env.ANTHROPIC_API_KEY) ok("proxy d'IA : réponse et facturation", rProxy.ok && Number(rProxy.headers.get("x-baobab-cost-fcfa")) >= 1);
else ok("proxy d'IA sans fournisseur configuré : 503 explicite", rProxy.status === 503);
await aicha.c.rpc("set_infra_resource_status", { p_resource: iaRes.resource_id, p_status: "paused" });
const rPaused = await fetch(`${APP}/api/centrale/ia/v1/messages`, { method: "POST", headers: { "x-api-key": iaRes.api_key }, body: "{}" });
ok("clé d'une ressource en pause refusée", rPaused.status === 402);

const { data: chain } = await admin.from("transactions").select("prev_hash, hash").order("id");
ok("journal des transactions chaîné", chain.every((t, i) => i === 0 || t.prev_hash === chain[i - 1].hash), `${chain.length} lignes`);

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
