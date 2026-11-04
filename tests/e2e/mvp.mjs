// Test de bout en bout du scénario §12.4 contre Supabase local + Next.js
import { createRequire } from "node:module";
import fs from "node:fs";

const appDir = process.argv[2] ?? process.cwd();
const require = createRequire(`${appDir}/package.json`);
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs.readFileSync(`${appDir}/.env.local`, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = "http://localhost:3000";
let failures = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

async function login(user) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: `${user}@baobab.dev`, password: "baobab2026" });
  if (error) throw new Error(`${user}: ${error.message}`);
  const ref = new URL(URL_).hostname.split(".")[0];
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`;
  return { c, id: data.user.id, cookie };
}

async function page(path, cookie, expect) {
  const res = await fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  const found = expect ? html.includes(expect) : true;
  ok(`page ${path}`, res.status === 200 && found, `${res.status}${expect && !found ? `, « ${expect} » absent` : ""}`);
  return html;
}

const aicha = await login("aicha");
const koffi = await login("koffi");
const moussa = await login("moussa");
const modo = await login("modo");

// Pages publiques et connectées
await page("/", null, "Chez nous");
await page("/questions", null, "webhook FedaPay");
await page("/showroom", null, "Tontine Pay");
await page("/squads", null, "Squad Zem Partage");
await page("/bourse", null, "SDK Wave");
await page("/classements", null, "Koffi");
await page("/u/koffi", null, "Expert");
await page("/fil", aicha.cookie, "Bonjour");
await page("/griot", aicha.cookie, "Le Griot");
await page("/portefeuille", aicha.cookie, "FCFA");
await page("/parametres", aicha.cookie, "Mon profil");
await page("/notifications", koffi.cookie, "Notifications");
await page("/moderation", modo.cookie, "Signalements");
const fatou = await login("fatou");
await page("/squads/d1000000-0000-4000-8000-000000000001", fatou.cookie, "Profils suggérés");
await page("/questions/b1000000-0000-4000-8000-000000000001", aicha.cookie, "X-FEDAPAY-SIGNATURE");

// 1. Profil d'Aïcha
const { data: aichaP } = await aicha.c.from("profiles").select("username, xp").eq("id", aicha.id).single();
ok("profil Aïcha", aichaP?.username === "aicha", `${aichaP?.xp} XP`);

// 2. Le Griot cite Koffi, qui gagne 5 XP
const before = (await koffi.c.from("profiles").select("xp").eq("id", koffi.id).single()).data.xp;
const t0 = Date.now();
const griotRes = await fetch(`${APP}/api/griot`, {
  method: "POST",
  headers: { cookie: aicha.cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ question: "Comment intégrer FedaPay dans Laravel et vérifier le webhook ?", channel: "whatsapp" }),
});
const griot = await griotRes.json();
const ms = Date.now() - t0;
ok("Griot répond avec sources", griotRes.ok && griot.status === "answered" && griot.sources.length > 0, `${ms} ms, sources: ${griot.sources?.map((s) => s.author_username).join(", ")}`);
ok("Griot cite Koffi", griot.sources?.some((s) => s.author_username === "koffi"));
ok("Griot < 8 s", ms < 8000);
const after = (await koffi.c.from("profiles").select("xp").eq("id", koffi.id).single()).data.xp;
ok("Koffi +5 XP par citation", after - before === 5 * griot.sources.filter((s) => s.author_username === "koffi").length, `${before} → ${after}`);

// 3. Ticket + abondement
const { data: bountyId, error: e1 } = await aicha.c.rpc("create_bounty", {
  p_title: "Paiement FedaPay bloqué en pending dans Laravel",
  p_description: "Le webhook ne met jamais la commande à payée.",
  p_repo_url: "https://github.com/aicha-dev/tontine-pay",
  p_acceptance_criteria: "tests/Feature/PaymentTest.php passe",
  p_deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  p_amount: 25000,
  p_tests_path: "tests/Feature/PaymentTest.php",
});
ok("ticket créé (25 000 FCFA)", !e1, e1?.message);
const { data: total, error: e2 } = await moussa.c.rpc("contribute_bounty", { p_bounty_id: bountyId, p_amount: 5000 });
ok("Moussa abonde", !e2 && total === 30000, e2?.message ?? `${total} FCFA`);
const { error: eSelf } = await aicha.c.rpc("submit_bounty", { p_bounty_id: bountyId, p_pr_url: "https://github.com/aicha-dev/tontine-pay/pull/1" });
ok("anti-fraude : la créatrice ne peut pas résoudre son ticket", !!eSelf);
const { error: eWallet } = await aicha.c.from("wallets").update({ balance: 9999999 }).eq("user_id", aicha.id).select();
const { data: w } = await aicha.c.from("wallets").select("balance").eq("user_id", aicha.id).single();
ok("RLS : portefeuille non modifiable directement", w.balance !== 9999999, eWallet?.message ?? `solde ${w.balance}`);
const { error: eXp } = await aicha.c.from("profiles").update({ xp: 99999 }).eq("id", aicha.id);
ok("RLS : XP non modifiable directement", !!eXp, eXp?.message);

// 4. Pair-Debugging : session + accès par lien
const { data: dbg, error: e3 } = await aicha.c.from("debug_sessions").insert({ host_id: aicha.id, title: "Webhook FedaPay" }).select("id, share_code").single();
ok("session de Pair-Debugging", !e3, e3?.message);
await page(`/debug/${dbg.share_code}`, koffi.cookie, "Webhook FedaPay");

// 5. PR de Koffi, tests (webhook simulé côté service), libération
const { data: subId, error: e4 } = await koffi.c.rpc("submit_bounty", { p_bounty_id: bountyId, p_pr_url: "https://github.com/aicha-dev/tontine-pay/pull/7", p_pr_number: 7 });
ok("Koffi soumet sa PR", !e4, e4?.message);
const { error: eFake } = await koffi.c.rpc("set_submission_tests", { p_submission_id: subId, p_passed: true, p_tests_modified: false });
ok("sécurité : Koffi ne peut pas marquer ses tests comme passés", !!eFake);
const { error: eEarly } = await aicha.c.rpc("release_bounty", { p_submission_id: subId });
ok("pas de libération sans tests passés", !!eEarly);
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await admin.rpc("set_submission_tests", { p_submission_id: subId, p_passed: true, p_tests_modified: false });
const koffiWalletBefore = (await koffi.c.from("wallets").select("balance").eq("user_id", koffi.id).single()).data.balance;
const { error: e5 } = await aicha.c.rpc("release_bounty", { p_submission_id: subId });
ok("Aïcha fusionne : prime libérée", !e5, e5?.message);
const koffiWalletAfter = (await koffi.c.from("wallets").select("balance").eq("user_id", koffi.id).single()).data.balance;
ok("Koffi reçoit 27 000 FCFA (30 000 - 10 %)", koffiWalletAfter - koffiWalletBefore === 27000, `${koffiWalletBefore} → ${koffiWalletAfter}`);

// 6. Badge Chasseur de primes + notification
const { data: badge } = await koffi.c.from("user_badges").select("badge_code").eq("user_id", koffi.id).eq("badge_code", "chasseur_primes_bronze").maybeSingle();
ok("badge Chasseur de primes débloqué", !!badge);
const { data: notif } = await koffi.c.from("notifications").select("kind").eq("user_id", koffi.id).in("kind", ["badge_unlocked", "bounty_paid", "griot_citation"]);
ok("notifications reçues par Koffi", (notif?.length ?? 0) >= 3, notif?.map((n) => n.kind).join(", "));
await page("/u/koffi", null, "Chasseur de primes");
await page(`/bourse/${bountyId}`, aicha.cookie, "Prime versée");

// Journal des transactions chaîné
const { data: chain } = await admin.from("transactions").select("id, prev_hash, hash").order("id");
const linked = chain.every((t, i) => i === 0 || t.prev_hash === chain[i - 1].hash);
ok("journal des transactions chaîné (SHA-256)", linked, `${chain.length} lignes`);

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
