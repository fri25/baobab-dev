// Code Forensic : confidentialité, auditeurs Experts, constats, confrontation, clôture, paiement, certificat, analyse auto
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
  return body;
}
const balance = async (u) => (await admin.from("wallets").select("balance").eq("user_id", u.id).single()).data.balance;

const [aicha, koffi, moussa, fatou, ibrahim, modo] = await Promise.all(["aicha", "koffi", "moussa", "fatou", "ibrahim", "modo"].map(login));
const { data: demo } = await admin.from("audits").select("id").like("title", "Tontine Pay%").single();
const AUDIT = demo.id;

// Pages et confidentialité
await page("/forensic", null, "Code Forensic");
const newAuditPage = await page("/forensic/new", aicha.cookie, "Bloquer le forfait");
ok("le porteur doit reconnaître avoir compris les clauses", newAuditPage.includes('name="nda"') && newAuditPage.includes("J’ai lu"));
await page(`/forensic/${AUDIT}`, aicha.cookie, "Webhook FedaPay accepté sans vérification");
const outsider = await page(`/forensic/${AUDIT}`, moussa.cookie, "Audit confidentiel");
ok("audit confidentiel : constats invisibles pour un tiers", !outsider.includes("Webhook FedaPay accepté"));
const { error: eRepo } = await moussa.c.from("audits").select("repo_url").eq("id", AUDIT);
ok("le dépôt d'un audit confidentiel est caché", !!eRepo, eRepo?.message);
const { data: priv } = await moussa.c.rpc("audit_private_details", { p_audit: AUDIT });
ok("détails privés refusés à un tiers", (priv?.length ?? 0) === 0);
const { data: kPriv } = await koffi.c.rpc("audit_private_details", { p_audit: AUDIT });
ok("l'auditeur voit le dépôt", kPriv?.[0]?.repo_url?.includes("tontine-pay"));

// Contestation sans autre auditeur : la modération tranche
const { data: n1 } = await admin.from("audit_findings").select("id").like("title", "Requête N+1%").single();
const { error: eSelfVote } = await koffi.c.rpc("vote_finding", { p_finding: n1.id, p_uphold: true });
ok("l'auteur d'un constat ne vote pas sur sa contestation", !!eSelfVote);
const { data: modDecision } = await modo.c.rpc("vote_finding", { p_finding: n1.id, p_uphold: false });
ok("sans autre auditeur, la modération tranche", modDecision === "dismissed", modDecision);

// Recrutement : Expert + accord de confidentialité, plafond d'auditeurs
const { error: eOwnJoin } = await aicha.c.rpc("join_audit", { p_audit: AUDIT, p_accept_nda: true });
ok("le porteur ne s'audite pas", !!eOwnJoin);
const { error: eLevel } = await moussa.c.rpc("join_audit", { p_audit: AUDIT, p_accept_nda: true });
ok("auditeur : niveau Expert requis", !!eLevel, eLevel?.message);
await admin.from("profiles").update({ xp: 2100 }).in("id", [moussa.id, fatou.id, ibrahim.id]);
const auditorJoinPage = await page(`/forensic/${AUDIT}`, moussa.cookie, "Devenir auditeur");
ok("l’auditeur peut lire les clauses avant d’accepter", auditorJoinPage.includes('name="nda"') && auditorJoinPage.includes("Lire les clauses"));
const { error: eNda } = await moussa.c.rpc("join_audit", { p_audit: AUDIT, p_accept_nda: false });
ok("accord de confidentialité obligatoire", !!eNda, eNda?.message);
const { error: eJoinMoussa } = await moussa.c.rpc("join_audit", { p_audit: AUDIT, p_accept_nda: true });
const { data: moussaNda } = await admin.from("audit_auditors").select("nda_accepted_at, nda_terms_version").eq("audit_id", AUDIT).eq("auditor_id", moussa.id).single();
ok("l’accord accepté par l’auditeur est horodaté et versionné", !eJoinMoussa && moussaNda?.nda_accepted_at && moussaNda.nda_terms_version === "nda-v1");
await fatou.c.rpc("join_audit", { p_audit: AUDIT, p_accept_nda: true });
const { error: eFull } = await ibrahim.c.rpc("join_audit", { p_audit: AUDIT, p_accept_nda: true });
ok("3 auditeurs maximum", !!eFull, eFull?.message);
await page(`/forensic/${AUDIT}`, moussa.cookie, "Ajouter un constat");

// Constat, contestation, vote à la majorité des autres auditeurs
const { data: mFinding, error: eAdd } = await moussa.c.rpc("add_audit_finding", {
  p_audit: AUDIT, p_category: "securite", p_severity: "moyen", p_title: "Mots de passe sans limitation des tentatives",
  p_description: "La route /login n'a pas de limitation de débit.", p_fix: "Ajouter le middleware throttle:5,1", p_file: "routes/web.php", p_effort: 1,
});
ok("un auditeur ajoute un constat", !eAdd, eAdd?.message);
const { error: eNotAud } = await ibrahim.c.rpc("add_audit_finding", {
  p_audit: AUDIT, p_category: "autre", p_severity: "mineur", p_title: "x", p_description: "x", p_fix: "", p_file: "", p_effort: 1,
});
ok("seuls les auditeurs de l'audit ajoutent des constats", !!eNotAud);
const { error: eShort } = await aicha.c.rpc("contest_finding", { p_finding: mFinding, p_reason: "non" });
ok("une contestation doit être argumentée", !!eShort);
await aicha.c.rpc("contest_finding", { p_finding: mFinding, p_reason: "Le throttle est déjà configuré dans le RouteServiceProvider." });
const { error: eClosePending } = await aicha.c.rpc("close_audit", { p_audit: AUDIT });
ok("pas de clôture pendant une contestation", !!eClosePending);
const { data: v1 } = await koffi.c.rpc("vote_finding", { p_finding: mFinding, p_uphold: true });
ok("1er vote : en attente de la majorité", v1 === "pending", v1);
const { data: v2 } = await fatou.c.rpc("vote_finding", { p_finding: mFinding, p_uphold: true });
ok("2e vote : constat maintenu", v2 === "upheld", v2);

// Clôture : score, certificat, paiement des auditeurs aux constats maintenus
const [k0, m0, f0] = [await balance(koffi), await balance(moussa), await balance(fatou)];
const { data: live } = await aicha.c.rpc("audit_score", { p_audit: AUDIT }).single();
const { data: code, error: eClose } = await aicha.c.rpc("close_audit", { p_audit: AUDIT });
ok("clôture du rapport final", !eClose && !!code, eClose?.message);
const { data: closed } = await admin.from("audits").select("status, score, effort_hours").eq("id", AUDIT).single();
ok("score final figé", closed.status === "closed" && closed.score === live.score, `${closed.score}/100, ${closed.effort_hours} h`);
ok("Koffi et Moussa payés 5 250 FCFA chacun (70 % de 15 000 / 2)", (await balance(koffi)) - k0 === 5250 && (await balance(moussa)) - m0 === 5250);
ok("Fatou, sans constat, n'est pas payée", (await balance(fatou)) === f0);
const { error: eLate } = await koffi.c.rpc("add_audit_finding", {
  p_audit: AUDIT, p_category: "autre", p_severity: "mineur", p_title: "x", p_description: "x", p_fix: "", p_file: "", p_effort: 1,
});
ok("plus de constat après clôture", !!eLate);
await page(`/forensic/certificat/${code}`, null, "Certificat Code Forensic");
const { error: eRate } = await aicha.c.rpc("rate_auditor", { p_audit: AUDIT, p_auditor: koffi.id, p_rating: 5 });
ok("le porteur note ses auditeurs", !eRate, eRate?.message);

// Nouvel audit : forfait bloqué et analyse automatique d'un vrai dépôt public
const a0 = await balance(aicha);
const { error: eOwnerNda } = await aicha.c.rpc("create_audit", {
  p_title: "Bibliothèque open source", p_repo_url: "https://github.com/sindresorhus/is", p_context: "Vérification avant publication",
  p_confidentiality: "private", p_max_auditors: 3, p_fee: 10000, p_days: 7, p_accept_nda: false,
});
ok("le porteur ne peut pas créer un audit confidentiel sans accord", !!eOwnerNda, eOwnerNda?.message);
const { data: newId, error: eNew } = await aicha.c.rpc("create_audit", {
  p_title: "Bibliothèque open source", p_repo_url: "https://github.com/sindresorhus/is", p_context: "Vérification avant publication",
  p_confidentiality: "public", p_max_auditors: 3, p_fee: 10000, p_days: 7, p_accept_nda: false,
});
ok("un audit public ne demande pas l’accord de confidentialité", !eNew && (await balance(aicha)) === a0 - 10000, eNew?.message);
const { data: ownerNda } = await admin.from("audits").select("owner_nda_accepted_at, owner_nda_terms_version").eq("id", newId).single();
ok("un audit public n’enregistre pas d’accord privé", ownerNda && !ownerNda.owner_nda_accepted_at && !ownerNda.owner_nda_terms_version);
const { error: eCheap } = await aicha.c.rpc("create_audit", {
  p_title: "x", p_repo_url: "https://github.com/a/b", p_context: "x", p_confidentiality: "public", p_max_auditors: 3, p_fee: 500, p_days: 7, p_accept_nda: true,
});
ok("forfait minimum de 10 000 FCFA", !!eCheap);

const res = await fetch(`${APP}/api/forensic/${newId}/analyze`, { method: "POST", headers: { cookie: aicha.cookie } });
const analysis = await res.json();
ok("analyse automatique d'un vrai dépôt public", res.ok && analysis.report?.accessible && analysis.report.source_files > 0,
  `${analysis.report?.files} fichiers, ${analysis.report?.test_files} tests, ${analysis.report?.dependencies_checked} dépendances vérifiées, ${analysis.findings} constat(s)`);
const resOther = await fetch(`${APP}/api/forensic/${newId}/analyze`, { method: "POST", headers: { cookie: moussa.cookie } });
ok("seul le porteur relance l'analyse", resOther.status === 404);

// Expiration sans auditeur : remboursement
await admin.from("audits").update({ deadline: new Date(Date.now() - 3600000).toISOString() }).eq("id", newId);
const a1 = await balance(aicha);
const cron = await (await fetch(`${APP}/api/cron`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })).json();
ok("audit expiré sans auditeur : remboursé", cron.refunded_audits === 1 && (await balance(aicha)) === a1 + 10000, JSON.stringify(cron).slice(0, 100));

const { data: chain } = await admin.from("transactions").select("prev_hash, hash").order("id");
ok("journal des transactions chaîné", chain.every((t, i) => i === 0 || t.prev_hash === chain[i - 1].hash), `${chain.length} lignes`);

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
