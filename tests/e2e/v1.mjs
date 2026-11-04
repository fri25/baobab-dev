// Test des fonctions V1 : défis, Stack Afrique, Micro-Bourse complète, PWA, GitHub vivant
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
async function page(path, cookie, expect) {
  const res = await fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  const found = expect ? body.includes(expect) : true;
  ok(`page ${path}`, res.status === 200 && found, `${res.status}${expect && !found ? `, « ${expect} » absent` : ""}`);
}
const xp = async (u) => (await admin.from("profiles").select("xp").eq("id", u.id).single()).data.xp;
const balance = async (u) => (await admin.from("wallets").select("balance").eq("user_id", u.id).single()).data.balance;

const [aicha, koffi, moussa, fatou, ibrahim, modo] = await Promise.all(["aicha", "koffi", "moussa", "fatou", "ibrahim", "modo"].map(login));

// Pages
await page("/defis", null, "Menu USSD");
await page("/stack", null, "FedaPay");
await page("/stack/fedapay", aicha.cookie, "Pièges connus");
await page("/activite", null, "GitHub vivant");
await page("/offline", null, "Pas de connexion");
await page("/manifest.webmanifest", null, "Baobab Dev");
await page("/sw.js", null, "pages-");
await page("/defis/new", modo.cookie, "Lancer un défi");

// --- Défis
const { data: ch } = await admin.from("challenges").select("id").eq("kind", "api").single();
await page(`/defis/${ch.id}`, modo.cookie, "Publier les résultats");
const { error: eSub } = await aicha.c.from("challenge_submissions").insert({ challenge_id: ch.id, user_id: aicha.id, solution_url: "https://github.com/aicha-dev/ussd" });
ok("Aïcha participe au défi", !eSub, eSub?.message);
const { error: eCheat } = await aicha.c.from("challenge_submissions").update({ score: 100 }).eq("challenge_id", ch.id).eq("user_id", aicha.id).select();
const { data: myScore } = await admin.from("challenge_submissions").select("score").eq("challenge_id", ch.id).eq("user_id", aicha.id).single();
ok("anti-triche : on ne s'attribue pas sa note", myScore.score === null, eCheat?.message);
for (const [u, s] of [[moussa, 92], [aicha, 85], [ibrahim, 70]]) {
  await modo.c.from("challenge_submissions").update({ score: s }).eq("challenge_id", ch.id).eq("user_id", u.id);
}
const xpBefore = await Promise.all([moussa, aicha, ibrahim].map(xp));
const { error: eClose } = await modo.c.rpc("close_challenge", { p_challenge_id: ch.id });
ok("clôture du défi par la modération", !eClose, eClose?.message);
const xpAfter = await Promise.all([moussa, aicha, ibrahim].map(xp));
ok("podium +100 / +60 / +30 XP", xpAfter[0] - xpBefore[0] === 100 && xpAfter[1] - xpBefore[1] === 60 && xpAfter[2] - xpBefore[2] === 30, xpAfter.map((v, i) => v - xpBefore[i]).join(" / "));
const { error: eClose2 } = await modo.c.rpc("close_challenge", { p_challenge_id: ch.id });
ok("pas de double attribution", !!eClose2);

// --- Stack Afrique
const { data: fedapay } = await admin.from("stack_items").select("id").eq("slug", "fedapay").single();
const { error: eEarly } = await modo.c.rpc("validate_stack_item", { p_item_id: fedapay.id, p_status: "verifie" });
ok("validation refusée sous 5 attestations", !!eEarly, eEarly?.message);
const { error: eAtt } = await ibrahim.c.from("stack_attestations").insert({ item_id: fedapay.id, user_id: ibrahim.id });
ok("5e attestation", !eAtt, eAtt?.message);
const { error: eNotMod } = await aicha.c.rpc("validate_stack_item", { p_item_id: fedapay.id, p_status: "verifie" });
ok("seule la modération valide", !!eNotMod);
const { error: eVal } = await modo.c.rpc("validate_stack_item", { p_item_id: fedapay.id, p_status: "verifie" });
const { data: st } = await admin.from("stack_items").select("status").eq("id", fedapay.id).single();
ok("FedaPay vérifié", !eVal && st.status === "verifie", eVal?.message);
const { error: eNew } = await aicha.c.from("stack_items").insert({ name: "Paystack", slug: "paystack", category: "paiement", description: "Paiements au Nigeria et au Ghana", created_by: aicha.id });
ok("proposer un outil", !eNew, eNew?.message);
const { error: eForge } = await aicha.c.from("stack_items").insert({ name: "Faux", slug: "faux", category: "autre", description: "x", created_by: aicha.id, status: "verifie" });
ok("impossible de proposer un outil déjà « vérifié »", !!eForge);
await admin.rpc("set_stack_health", { p_item_id: fedapay.id, p_up: false });
const { data: down } = await admin.from("notifications").select("user_id").eq("kind", "stack_down");
ok("alerte de panne aux devs en production", (down?.length ?? 0) === 5, `${down?.length} notifiés`);

// --- Micro-Bourse : prolongation
const { data: wave } = await admin.from("bounties").select("id, deadline").ilike("title", "SDK Wave%").single();
const { data: ext1 } = await ibrahim.c.rpc("vote_bounty_extension", { p_bounty_id: wave.id, p_days: 7 });
ok("Ibrahim (5 000 / 20 000) vote : pas encore prolongé", ext1 === false);
const { error: eNotContrib } = await aicha.c.rpc("vote_bounty_extension", { p_bounty_id: wave.id, p_days: 7 });
ok("seuls les contributeurs votent", !!eNotContrib);
const { data: ext2 } = await moussa.c.rpc("vote_bounty_extension", { p_bounty_id: wave.id, p_days: 14 });
const { data: after } = await admin.from("bounties").select("deadline").eq("id", wave.id).single();
const gained = (new Date(after.deadline) - new Date(wave.deadline)) / 86400000;
ok("majorité des fonds : prolongé de 7 jours (minimum voté)", ext2 === true && Math.round(gained) === 7, `${gained.toFixed(1)} j`);

// --- Micro-Bourse : litige et arbitrage
const { data: subId } = await aicha.c.rpc("submit_bounty", { p_bounty_id: wave.id, p_pr_url: "https://github.com/moussa/wave-sdk-node/pull/3", p_pr_number: 3 });
const { error: eDisp } = await aicha.c.from("disputes").insert({ bounty_id: wave.id, opened_by: aicha.id, reason: "Mes tests passent en local mais le créateur ne répond plus." });
ok("Aïcha ouvre un litige", !eDisp, eDisp?.message);
const { data: dispute } = await admin.from("disputes").select("id, arbiters, submission_id").eq("bounty_id", wave.id).single();
ok("arbitres tirés au sort hors parties (seniors)", dispute.arbiters.includes(koffi.id) && !dispute.arbiters.includes(moussa.id) && !dispute.arbiters.includes(aicha.id), `${dispute.arbiters.length} arbitre(s)`);
ok("PR contestée rattachée", dispute.submission_id === subId);
const { data: bStatus } = await admin.from("bounties").select("status").eq("id", wave.id).single();
ok("ticket passé en litige", bStatus.status === "disputed");
const { error: eNotArb } = await aicha.c.rpc("vote_dispute", { p_dispute_id: dispute.id, p_decision: "pay" });
ok("une partie ne peut pas arbitrer", !!eNotArb);
const aichaBefore = await balance(aicha);
const { data: decision, error: eVote } = await koffi.c.rpc("vote_dispute", { p_dispute_id: dispute.id, p_decision: "pay" });
ok("Koffi arbitre : prime versée", !eVote && decision === "pay", eVote?.message ?? decision);
ok("Aïcha reçoit 18 000 FCFA (20 000 - 10 %)", (await balance(aicha)) - aichaBefore === 18000);
await page(`/bourse/${wave.id}`, koffi.cookie, "Litige tranché");

// --- Micro-Bourse : expiration et remboursement
const { data: newB } = await fatou.c.rpc("create_bounty", {
  p_title: "Mode hors ligne Flutter", p_description: "Cache Hive", p_repo_url: "https://github.com/fatou/zem-partage",
  p_acceptance_criteria: "test/offline_test.dart passe", p_deadline: new Date(Date.now() + 86400000).toISOString(), p_amount: 10000,
});
await koffi.c.rpc("contribute_bounty", { p_bounty_id: newB, p_amount: 4000 });
await admin.from("bounties").update({ deadline: new Date(Date.now() - 3600000).toISOString() }).eq("id", newB);
const [fatouB, koffiB] = [await balance(fatou), await balance(koffi)];
const cron = await fetch(`${APP}/api/cron`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
const cronJson = await cron.json();
ok("tâche quotidienne", cron.ok && cronJson.expired_bounties >= 1, JSON.stringify(cronJson).slice(0, 120));
ok("contributeurs remboursés au prorata", (await balance(fatou)) - fatouB === 10000 && (await balance(koffi)) - koffiB === 4000);
const unauth = await fetch(`${APP}/api/cron`);
ok("tâche quotidienne protégée", unauth.status === 401);

// --- Journal toujours chaîné
const { data: chain } = await admin.from("transactions").select("prev_hash, hash").order("id");
ok("journal des transactions chaîné", chain.every((t, i) => i === 0 || t.prev_hash === chain[i - 1].hash), `${chain.length} lignes`);

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
