// Test de la correction automatique des défis : correcteur isolé, tests cachés, RLS, clôture
import { createRequire } from "node:module";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const appDir = process.argv[2] ?? process.cwd();
const require = createRequire(`${appDir}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { judge, sameValue } = await import(pathToFileURL(`${appDir}/src/lib/judge-runner.mjs`).href);
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
  const missing = (Array.isArray(expect) ? expect : [expect]).filter((e) => e && !body.includes(e));
  ok(`page ${path}`, res.status === 200 && !missing.length, `${res.status}${missing.length ? `, absent : ${missing.join(", ")}` : ""}`);
  return body;
}
const xp = async (u) => (await admin.from("profiles").select("xp").eq("id", u.id).single()).data.xp;

const [aicha, moussa, ibrahim, modo] = await Promise.all(["aicha", "moussa", "ibrahim", "modo"].map(login));
const { data: ch } = await admin.from("challenges").select("id, function_name").eq("grading", "auto").single();
const { data: allTests } = await admin.from("challenge_tests").select("args, expected, is_public").eq("challenge_id", ch.id).order("position");

// --- Correcteur
const tests2 = [
  { args: [1, 2], expected: 3, is_public: true },
  { args: [5, 5], expected: 10, is_public: false },
];
const good = await judge("function add(a, b) { return a + b }", "add", tests2);
ok("bonne solution : 100/100", good.score === 100 && good.passed === 2, JSON.stringify(good));
const wrong = await judge("function add(a, b) { return a - b }", "add", tests2);
ok("mauvaise solution : 0/100, détail des exemples", wrong.score === 0 && wrong.results[0].got === "-1" && wrong.results[0].expected === "3");
ok("test caché : ni entrée, ni attendu, ni obtenu", !("args" in wrong.results[1]) && !("expected" in wrong.results[1]) && !("got" in wrong.results[1]));
ok("erreur de syntaxe signalée", /SyntaxError/.test((await judge("function add(a, b) { return a +", "add", tests2)).error ?? ""));
ok("fonction absente signalée", /introuvable/.test((await judge("function plus() {}", "add", tests2)).error ?? ""));
const loop = await judge("function add() { while (true) {} }", "add", tests2);
ok("boucle infinie coupée à 1 s par test", loop.results.every((r) => !r.pass) && /Délai/.test(loop.results[0].error ?? ""));
const micro = await judge("function add() { const f = () => Promise.resolve().then(f); f(); return 3 }", "add", tests2);
ok("boucle de microtâches coupée", micro.passed === 0);
const mem = await judge("function add() { const a = []; while (true) a.push(new Array(1e6).fill(1)) }", "add", tests2);
ok("dépassement mémoire contenu", mem.score === 0 && !!mem.error, mem.error);
const esc = await judge(
  "function add() { let r = []; r.push(typeof process, typeof require); try { r.push(this.constructor.constructor('return typeof process')()) } catch { r.push('bloqué') } try { r.push((function(){}).constructor('return typeof globalThis.process')()) } catch { r.push('bloqué') } return r.join() }",
  "add",
  [{ args: [], expected: "", is_public: true }],
);
ok("pas d'accès à process ni require depuis la solution", esc.results[0].got === '"undefined,undefined,undefined,undefined"', esc.results[0].got);
// import() ne peut se résoudre qu'après le retour : le 1er test le lance, le 2e lit son issue.
const fsRead = await judge(
  `function f(step) {
    if (step === 1) {
      globalThis.r = "en attente";
      try { this.constructor.constructor('return import("node:fs")')().then(() => (globalThis.r = "importé"), (e) => (globalThis.r = "bloqué")); }
      catch { globalThis.r = "bloqué"; }
      return 0;
    }
    return globalThis.r;
  }`,
  "f",
  [
    { args: [1], expected: 0, is_public: true },
    { args: [2], expected: "bloqué", is_public: true },
  ],
);
ok("pas d'import de module (node:fs)", fsRead.passed === 2, JSON.stringify(fsRead.results[1]));
ok("comparaison : ordre des clés indifférent, flottants tolérés", sameValue({ a: 1, b: [0.1 + 0.2] }, { b: [0.3], a: 1 }) && !sameValue([1, 2], [2, 1]));

// --- Jeu de tests du défi de démo : la solution de Moussa passe tout, celle d'Ibrahim (glouton) non
const { data: sols } = await admin
  .from("challenge_solutions")
  .select("code, challenge_submissions!inner(user_id, score)")
  .eq("challenge_submissions.challenge_id", ch.id);
for (const s of sols) {
  const r = await judge(s.code, ch.function_name, allTests);
  ok(`solution de démo notée ${s.challenge_submissions.score}`, r.score === Number(s.challenge_submissions.score), `${r.score}`);
}

// --- RLS
const { data: seen } = await aicha.c.from("challenge_tests").select("is_public").eq("challenge_id", ch.id);
ok("participant : seuls les exemples publics sont lisibles", seen.length === 2 && seen.every((t) => t.is_public), `${seen.length}`);
const { data: seenModo } = await modo.c.from("challenge_tests").select("id").eq("challenge_id", ch.id);
ok("modération : tous les tests", seenModo.length === 8);
const { data: counts } = await aicha.c.rpc("challenge_test_counts", { p_challenge_id: ch.id }).single();
ok("compteur de tests sans les révéler", counts.total === 8 && counts.public_count === 2);
const { error: eTest } = await aicha.c.from("challenge_tests").insert({ challenge_id: ch.id, args: [], expected: 1, is_public: true });
ok("un participant n'ajoute pas de test", !!eTest);
const { error: eDirect } = await aicha.c.from("challenge_submissions").insert({ challenge_id: ch.id, user_id: aicha.id, solution_url: "https://x.dev" });
ok("pas de participation directe à un défi automatique", !!eDirect);
const { error: eScore } = await aicha.c
  .from("challenge_submissions")
  .insert({ challenge_id: ch.id, user_id: aicha.id, solution_url: "https://x.dev", score: 100, graded_at: new Date().toISOString() });
ok("pas de score auto-attribué", !!eScore);
const { data: othersCode } = await aicha.c.from("challenge_solutions").select("code");
ok("le code des autres reste privé pendant le défi", othersCode.length === 0, `${othersCode.length}`);
const { data: ownCode } = await moussa.c.from("challenge_solutions").select("code");
ok("chacun relit son propre code", ownCode.length === 1);
const { error: eSolIns } = await aicha.c.from("challenge_solutions").insert({ submission_id: sols[0].id ?? "00000000-0000-0000-0000-000000000000", code: "x", report: {} });
ok("pas d'écriture directe de solution", !!eSolIns);

// --- Pages
await page("/defis", null, ["Rendu de monnaie", "Correction automatique"]);
await page(`/defis/${ch.id}`, aicha.cookie, ["Signature", "rendreMonnaie", "Tester sur les exemples", "dont 6 cachés"]);
const anon = await page(`/defis/${ch.id}`, null, "8/8 tests");
ok("tests cachés absents de la page", !anon.includes("[100000,[5000,2000,25]]") && !anon.includes("100000, [5000"));
await page("/defis/new", modo.cookie, ["Solution de référence", "Automatique"]);

// --- Clôture : départage au premier ayant atteint le score, puis tout devient public
const before = await Promise.all([moussa, ibrahim].map(xp));
const { error: eClose } = await modo.c.rpc("close_challenge", { p_challenge_id: ch.id });
ok("clôture du défi automatique", !eClose, eClose?.message);
const after = await Promise.all([moussa, ibrahim].map(xp));
ok("podium : Moussa +100, Ibrahim +60", after[0] - before[0] === 100 && after[1] - before[1] === 60, after.map((v, i) => v - before[i]).join(" / "));
const { data: seenAfter } = await aicha.c.from("challenge_tests").select("id").eq("challenge_id", ch.id);
ok("après clôture, les tests cachés sont publiés", seenAfter.length === 8);
const { data: codesAfter } = await aicha.c.from("challenge_solutions").select("code");
ok("après clôture, les solutions sont lisibles", codesAfter.length === 2);

console.log(failures ? `\n${failures} échec(s)` : "\nTout est vert.");
process.exit(failures ? 1 : 0);
