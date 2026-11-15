// Correcteur automatique des défis (JavaScript).
// Le code du participant tourne dans un processus Node séparé, sous le modèle de permissions
// (pas de fichiers, pas de sous-processus, pas de workers), sans variables d'environnement,
// avec 64 Mo de mémoire, 1 s par test et 10 s au total. Dans ce processus, il s'exécute
// dans un contexte vm vide : seules des chaînes JSON franchissent la frontière.
// Les valeurs attendues ne sont jamais envoyées au processus : la comparaison se fait ici.
import { spawn } from "node:child_process";

const TEST_TIMEOUT_MS = 1000;
const TOTAL_TIMEOUT_MS = 10000;
const MAX_OUTPUT = 512 * 1024;
export const MAX_CODE_LENGTH = 20000;
export const FN_NAME = /^[A-Za-z_$][\w$]{0,63}$/;

const RUNNER = String.raw`
import vm from "node:vm";
let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;
const { code, fn, args, timeout } = JSON.parse(raw);
const ctx = vm.createContext(Object.create(null), {
  codeGeneration: { strings: true, wasm: false },
  microtaskMode: "afterEvaluate",
});
const str = (v) => (typeof v === "string" ? v.slice(0, 2000) : "Erreur inconnue");
const run = (src, file) => new vm.Script(src, { filename: file }).runInContext(ctx, { timeout });
const results = [];
try {
  run(code + "\n;globalThis.__baobabFn = typeof " + fn + ' === "function" ? ' + fn + " : undefined;", "solution.js");
  const found = run("typeof globalThis.__baobabFn", "check.js");
  if (found !== "function") throw "La fonction " + fn + " est introuvable.";
} catch (e) {
  // Erreur hôte (syntaxe, délai) : lue ici. Erreur levée par le code : lue dans le contexte,
  // pour ne jamais exposer un objet de l'hôte au code du participant.
  const msg = typeof e === "string" ? e
    : e instanceof Error ? (e.code === "ERR_SCRIPT_EXECUTION_TIMEOUT" ? "Délai dépassé au chargement du code" : e.name + " : " + e.message)
    : str(run2(e));
  process.stdout.write(JSON.stringify({ compile: msg }));
  process.exit(0);
}
function run2(e) {
  // Lit le message d'une erreur venue du contexte sans exécuter de code hors délai.
  try { ctx.__baobabErr = e; return run('(() => { const e = globalThis.__baobabErr; delete globalThis.__baobabErr; try { return String(e && e.message !== undefined ? e.message : e); } catch { return "Erreur"; } })()', "err.js"); }
  catch { return "Erreur (délai dépassé ou valeur illisible)"; }
}
for (const a of args) {
  const t0 = performance.now();
  let out;
  try {
    const r = run(
      "(() => { try { const v = globalThis.__baobabFn(...JSON.parse(" + JSON.stringify(a) + ")); " +
        "if (v && typeof v.then === 'function') return JSON.stringify({ e: 'La fonction doit être synchrone (pas de Promise).' }); " +
        "const s = JSON.stringify(v); return JSON.stringify(s === undefined ? { u: 1 } : { v: s }); } " +
        "catch (e) { let m; try { m = String(e && e.message !== undefined ? e.message : e); } catch { m = 'Erreur'; } return JSON.stringify({ e: m }); } })()",
      "test.js",
    );
    out = typeof r === "string" ? r : JSON.stringify({ e: "Résultat illisible" });
  } catch (e) {
    const timedOut = e && e.code === "ERR_SCRIPT_EXECUTION_TIMEOUT";
    out = JSON.stringify({ e: timedOut ? "Délai dépassé (1 s)" : "Erreur d'exécution" });
  }
  results.push({ r: out.slice(0, 20000), ms: Math.round(performance.now() - t0) });
}
process.stdout.write(JSON.stringify({ results }));
`;

const permissionFlag = Number(process.versions.node.split(".")[0]) >= 23 ? "--permission" : "--experimental-permission";

function execute(payload) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [permissionFlag, "--disable-warning=ExperimentalWarning", "--max-old-space-size=64", "--input-type=module", "-e", RUNNER],
      { env: {}, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    let out = "";
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      resolve(value);
    };
    const timer = setTimeout(() => finish({ fatal: "Délai total dépassé (10 s)" }), TOTAL_TIMEOUT_MS);
    child.stdout.on("data", (d) => {
      out += d;
      if (out.length > MAX_OUTPUT) finish({ fatal: "Sortie trop volumineuse" });
    });
    child.on("error", () => finish({ fatal: "Le correcteur n'a pas pu démarrer" }));
    child.on("close", (code) => {
      try {
        finish(JSON.parse(out));
      } catch {
        finish({ fatal: code ? "Mémoire ou ressources dépassées" : "Réponse du correcteur illisible" });
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(payload));
  });
}

// Égalité profonde : ordre des clés indifférent, tolérance 1e-9 sur les nombres.
export function sameValue(a, b) {
  if (typeof a === "number" && typeof b === "number") return a === b || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && sameValue(a[k], b[k]));
}

const short = (v) => {
  const s = v === undefined ? "undefined" : JSON.stringify(v);
  return s.length > 300 ? `${s.slice(0, 300)}…` : s;
};

/**
 * Corrige une solution.
 * @param {string} code
 * @param {string} fn nom de la fonction à appeler
 * @param {{ args: unknown[]; expected: unknown; is_public: boolean }[]} tests
 */
export async function judge(code, fn, tests) {
  const total = tests.length;
  if (!FN_NAME.test(fn)) return { error: "Nom de fonction invalide", results: [], passed: 0, total, score: 0 };
  if (!code.trim()) return { error: "Le code est vide", results: [], passed: 0, total, score: 0 };
  if (code.length > MAX_CODE_LENGTH) return { error: `Code trop long (${MAX_CODE_LENGTH} caractères max.)`, results: [], passed: 0, total, score: 0 };

  const raw = await execute({ code, fn, args: tests.map((t) => JSON.stringify(t.args)), timeout: TEST_TIMEOUT_MS });
  if (raw.fatal || raw.compile) return { error: raw.fatal ?? raw.compile, results: [], passed: 0, total, score: 0 };

  const results = tests.map((t, i) => {
    const r = raw.results?.[i];
    let res = { error: "Non exécuté" };
    try {
      if (r) res = JSON.parse(r.r);
    } catch {
      res = { error: "Résultat illisible" };
    }
    let got;
    let error = res.e;
    if (!error) {
      try {
        got = res.u ? undefined : JSON.parse(res.v);
      } catch {
        error = "Résultat illisible";
      }
    }
    const pass = !error && sameValue(got, t.expected);
    const base = { index: i + 1, public: t.is_public, pass, ms: r?.ms ?? null };
    // Les tests cachés ne révèlent ni les entrées, ni le résultat attendu, ni le résultat obtenu.
    if (!t.is_public) return { ...base, error: error && !pass ? "Erreur ou délai dépassé" : undefined };
    return { ...base, args: short(t.args), expected: short(t.expected), got: error ? undefined : short(got), error };
  });
  const passed = results.filter((r) => r.pass).length;
  return { results, passed, total, score: total ? Math.round((passed / total) * 10000) / 100 : 0 };
}
