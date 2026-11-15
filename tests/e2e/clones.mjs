// Clone IA du senior : réponses sourcées, facturation 70/30, Pass, remboursement, suspension, création
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
  const body = res.status === 200 ? (await res.text()).replace(/<!-- -->/g, "") : "";
  const found = expect ? body.includes(expect) : true;
  ok(`page ${path}`, res.status === 200 && found, `${res.status}${expect && !found ? `, « ${expect} » absent` : ""}`);
}
const balance = async (u) => (await admin.from("wallets").select("balance").eq("user_id", u.id).single()).data.balance;
const CLONE = "f1000000-0000-4000-8000-000000000001";
async function ask(u, question) {
  const res = await fetch(`${APP}/api/clones/${CLONE}/ask`, {
    method: "POST",
    headers: { cookie: u.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return { http: res.status, ...(await res.json()) };
}

const [aicha, koffi, ibrahim, fatou] = await Promise.all(["aicha", "koffi", "ibrahim", "fatou"].map(login));

// Pages
await page("/clones", null, "Koffi IA");
await page(`/clones/${CLONE}`, aicha.cookie, "première question est offerte");
await page("/clones/mon-clone", koffi.cookie, "Revenus cumulés");
await page("/clones/mon-clone", aicha.cookie, "niveau <strong>Expert</strong>");

// Première question gratuite, réponse sourcée
const [a0, k0] = [await balance(aicha), await balance(koffi)];
const r1 = await ask(aicha, "Comment rendre un paiement Mobile Money idempotent pour ne pas livrer deux fois ?");
ok("réponse sourcée du clone", r1.http === 200 && r1.status === "answered" && r1.sources?.length > 0, `${r1.billing}, sources : ${r1.sources?.map((s) => s.title).join(" | ")}`);
ok("première question offerte", r1.billing === "free_first" && (await balance(aicha)) === a0);

// Deuxième question : 100 FCFA, 70 au senior
const r2 = await ask(aicha, "Faut-il traiter un webhook de paiement directement dans le contrôleur Laravel ?");
ok("deuxième question facturée 100 FCFA", r2.billing === "paid" && (await balance(aicha)) === a0 - 100, r2.error);
ok("70 FCFA reversés au senior", (await balance(koffi)) === k0 + 70);

// Répétition : non facturée
const r3 = await ask(aicha, "Faut-il traiter un webhook de paiement directement dans le contrôleur Laravel ?");
ok("question répétée non facturée", r3.billing === "repeat" && (await balance(aicha)) === a0 - 100);

// Sans source : rien n'est inventé ni facturé
const r4 = await ask(aicha, "Quelle est la meilleure recette de riz au gras pour un mariage ?");
ok("sans source : le clone n'invente rien", r4.status === "no_source" || r4.status === "out_of_scope", r4.status);
ok("sans source : pas facturé", r4.billing === "not_billed" && (await balance(aicha)) === a0 - 100);

// Le serveur seul enregistre et facture
const { error: eForge } = await aicha.c.rpc("record_clone_query", {
  p_user: aicha.id, p_clone: CLONE, p_question: "x", p_answer: "réponse inventée", p_status: "answered", p_cited: [],
});
ok("impossible d'enregistrer une fausse réponse", !!eForge);
const { data: spySources } = await aicha.c.from("clone_sources").select("id").eq("clone_id", CLONE);
ok("RLS : les sources du senior restent privées", spySources?.length === 0);

// Mauvaise réponse signalée : remboursée, et retirée au senior
const k1 = await balance(koffi);
const { error: eFlag } = await aicha.c.rpc("flag_clone_query", { p_query: r2.queryId, p_reason: "Ne répond pas à ma question" });
ok("signalement : 100 FCFA remboursés", !eFlag && (await balance(aicha)) === a0, eFlag?.message);
ok("signalement : la part du senior est annulée", (await balance(koffi)) === k1 - 70);
const { error: eFlag2 } = await aicha.c.rpc("flag_clone_query", { p_query: r2.queryId, p_reason: "encore" });
ok("pas de double remboursement", !!eFlag2);

// Mode test du senior
const k2 = await balance(koffi);
const rOwner = await ask(koffi, "Comment rendre un paiement idempotent ?");
ok("le senior teste son clone gratuitement", rOwner.billing === "owner_test" && (await balance(koffi)) === k2);

// Pass Clones : 2 000 FCFA, puis répartition au prorata (70 %)
const i0 = await balance(ibrahim);
const { error: ePass } = await ibrahim.c.rpc("buy_clone_pass");
ok("achat du Pass Clones", !ePass && (await balance(ibrahim)) === i0 - 2000, ePass?.message);
const rPass = await ask(ibrahim, "Comment utiliser les files d'attente Laravel pour les paiements ?");
ok("question incluse dans le Pass", rPass.billing === "pass" && (await balance(ibrahim)) === i0 - 2000, rPass.billing);
const k3 = await balance(koffi);
const month = new Date().toISOString().slice(0, 8) + "01";
const { error: eDist } = await admin.rpc("distribute_clone_passes", { p_month: month });
ok("Pass réparti : 1 400 FCFA au senior (70 % de 2 000)", !eDist && (await balance(koffi)) === k3 + 1400, eDist?.message ?? `${(await balance(koffi)) - k3}`);
await admin.rpc("distribute_clone_passes", { p_month: month });
ok("pas de double répartition", (await balance(koffi)) === k3 + 1400);

// Avis et suspension sous 2,5 de moyenne (5 avis minimum)
await aicha.c.rpc("rate_clone_query", { p_query: r1.queryId, p_rating: 2 });
const { data: before } = await admin.from("ai_clones").select("status").eq("id", CLONE).single();
ok("note correcte : clone toujours publié", before.status === "published");
await admin.from("clone_queries").update({ rating: 1 }).eq("clone_id", CLONE).neq("billing", "owner_test").neq("id", r1.queryId);
await aicha.c.rpc("rate_clone_query", { p_query: r1.queryId, p_rating: 1 });
const { data: after } = await admin.from("ai_clones").select("status").eq("id", CLONE).single();
ok("note trop basse : clone suspendu", after.status === "suspended");
const { data: notif } = await admin.from("notifications").select("kind").eq("user_id", koffi.id).eq("kind", "clone_suspended");
ok("le senior est prévenu", notif?.length === 1);

// Création : niveau Expert requis, 3 sources pour publier
const { error: eLevel } = await aicha.c.rpc("create_clone", { p_name: "Aïcha IA", p_specialty: "Laravel", p_description: "", p_style: "" });
ok("création réservée au niveau Expert", !!eLevel, eLevel?.message);
await admin.from("profiles").update({ xp: 2100 }).eq("id", fatou.id);
const { data: fClone, error: eCreate } = await fatou.c.rpc("create_clone", { p_name: "Fatou IA", p_specialty: "Flutter hors ligne", p_description: "", p_style: "pédagogue" });
ok("une Expert crée son clone", !eCreate, eCreate?.message);
const { error: eEarly } = await fatou.c.rpc("set_clone_status", { p_status: "published" });
ok("publication refusée sous 3 sources", !!eEarly, eEarly?.message);
for (const t of ["Cache Hive", "APK léger", "Synchronisation"]) {
  await fatou.c.from("clone_sources").insert({ clone_id: fClone, kind: "note", title: t, content: `Note de Fatou sur ${t}.` });
}
const { error: ePub } = await fatou.c.rpc("set_clone_status", { p_status: "published" });
ok("publication avec 3 sources", !ePub, ePub?.message);
const { error: eFake } = await fatou.c.from("clone_sources").insert({ clone_id: CLONE, kind: "note", title: "x", content: "y" });
ok("impossible d'ajouter des sources au clone d'un autre", !!eFake);

const { data: chain } = await admin.from("transactions").select("prev_hash, hash").order("id");
ok("journal des transactions chaîné", chain.every((t, i) => i === 0 || t.prev_hash === chain[i - 1].hash), `${chain.length} lignes`);

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
