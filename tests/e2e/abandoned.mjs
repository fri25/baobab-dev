// Détecteur de projets abandonnés : détection, choix du propriétaire, reprise, crédit du fondateur, vrai dépôt GitHub
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
}
const project = async (slug) => (await admin.from("projects").select("*").eq("slug", slug).single()).data;
const xp = async (u) => (await admin.from("profiles").select("xp").eq("id", u.id).single()).data.xp;

const [aicha, moussa, fatou, ibrahim] = await Promise.all(["aicha", "moussa", "fatou", "ibrahim"].map(login));
const meteo = await project("meteo-agri-senegal");
const artisans = await project("artisans-ouaga");

// Pages
await page("/showroom", null, "Tontine Pay", "Météo Agri Sénégal");
await page("/showroom/relancer", null, "Annuaire des artisans de Ouaga", "Météo Agri Sénégal");
await page("/showroom/meteo-agri-senegal", moussa.cookie, "Le relancer avec une Squad");
await page("/showroom/meteo-agri-senegal", aicha.cookie, "propriétaire a été prévenu", "Le céder à la communauté");
await page("/showroom/artisans-ouaga", aicha.cookie, "Reprendre ce projet");

// Détection (statistiques relevées par le serveur uniquement)
const { error: eForge } = await aicha.c.rpc("set_project_repo_stats", {
  p_project: meteo.id, p_last_commit: new Date().toISOString(), p_stars: 0, p_forks: 0, p_unanswered: 0,
});
ok("seul le serveur relève les statistiques du dépôt", !!eForge);
const tontine = await project("tontine-pay");
const old = new Date(Date.now() - 200 * 86400000).toISOString();
const { data: d1 } = await admin.rpc("set_project_repo_stats", { p_project: tontine.id, p_last_commit: old, p_stars: 5, p_forks: 1, p_unanswered: 0 });
ok("inactif mais sans issue en attente : pas abandonné", d1 === false);
const { data: d2 } = await admin.rpc("set_project_repo_stats", { p_project: tontine.id, p_last_commit: old, p_stars: 0, p_forks: 0, p_unanswered: 3 });
ok("inactif sans aucun intérêt passé : pas signalé", d2 === false);
const { data: d3 } = await admin.rpc("set_project_repo_stats", { p_project: tontine.id, p_last_commit: old, p_stars: 5, p_forks: 1, p_unanswered: 2 });
ok("6 mois sans commit + intérêt + issues sans réponse : détecté", d3 === true && (await project("tontine-pay")).abandon_status === "detected");
const { data: notif } = await admin.from("notifications").select("id").eq("user_id", aicha.id).eq("kind", "project_abandoned");
ok("le propriétaire est prévenu", notif?.length === 1);
await admin.rpc("set_project_repo_stats", { p_project: tontine.id, p_last_commit: new Date().toISOString(), p_stars: 5, p_forks: 1, p_unanswered: 2 });
ok("nouveau commit : le projet n'est plus signalé", (await project("tontine-pay")).abandon_status === null);

// Choix du propriétaire
const { error: eNotOwner } = await aicha.c.rpc("decide_abandoned_project", { p_project: meteo.id, p_choice: "ceder" });
ok("seul le propriétaire décide", !!eNotOwner);
const { data: squadId, error: eRevive } = await moussa.c.rpc("decide_abandoned_project", { p_project: meteo.id, p_choice: "relancer" });
const { data: squad } = await admin.from("squads").select("status, project_id, skills_needed").eq("id", squadId).single();
ok("relancer : une Squad est ouverte", !eRevive && squad?.status === "recruiting" && squad.project_id === meteo.id, eRevive?.message);
ok("relancer : le projet repasse en construction", (await project("meteo-agri-senegal")).status === "building");
await page("/showroom/relancer", null, "Rejoindre la Squad");

const zem = await project("zem-partage");
await admin.rpc("set_project_repo_stats", { p_project: zem.id, p_last_commit: old, p_stars: 3, p_forks: 0, p_unanswered: 1 });
await fatou.c.rpc("decide_abandoned_project", { p_project: zem.id, p_choice: "archiver" });
ok("archiver", (await project("zem-partage")).abandon_status === "archived");
await page("/showroom", null, "Wari Map", "Zem Partage");

// Reprise d'un projet cédé
const { error: eOwn } = await ibrahim.c.rpc("adopt_project", { p_project: artisans.id });
ok("on ne reprend pas son propre projet", !!eOwn);
const x0 = await xp(aicha);
const { error: eAdopt } = await aicha.c.rpc("adopt_project", { p_project: artisans.id });
const after = await project("artisans-ouaga");
ok("Aïcha reprend le projet", !eAdopt && after.owner_id === aicha.id && after.abandon_status === "adopted", eAdopt?.message);
ok("le fondateur reste crédité", after.founder_id === ibrahim.id);
ok("+15 XP pour la reprise", (await xp(aicha)) - x0 === 15);
const { data: badge } = await admin.from("user_badges").select("badge_code").eq("user_id", ibrahim.id).eq("badge_code", "passeur_flambeau_bronze");
ok("badge « Passeur de flambeau » pour le fondateur", badge?.length === 1);
const { error: eTwice } = await moussa.c.rpc("adopt_project", { p_project: artisans.id });
ok("un projet repris ne l'est pas deux fois", !!eTwice);
await page("/showroom/artisans-ouaga", null, "Fondé par");

// Vérification réelle sur GitHub (dépôt actif)
await admin.from("projects").update({ repo_url: "https://github.com/sindresorhus/is" }).eq("id", tontine.id);
const res = await fetch(`${APP}/api/projects/${tontine.id}/check`, { method: "POST", headers: { cookie: aicha.cookie } });
const check = await res.json();
ok("vérification d'un vrai dépôt GitHub actif", res.ok && check.checked && check.detected === false, `★ ${check.stars}, dernier commit ${check.last_commit}`);
const resOther = await fetch(`${APP}/api/projects/${tontine.id}/check`, { method: "POST", headers: { cookie: moussa.cookie } });
ok("seul le propriétaire lance la vérification", resOther.status === 404);
const cron = await (await fetch(`${APP}/api/cron`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })).json();
ok("la tâche quotidienne vérifie les projets", typeof cron.projects?.checked === "number", JSON.stringify(cron.projects));

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
