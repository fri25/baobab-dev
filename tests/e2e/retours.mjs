// Retours du 11/11/2026 : navigation par catégories, Markdown, sujets programmés et invitations,
// validation du Radar, accord de confidentialité signé (PDF), photo de profil, « collaborateurs ».
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
async function page(path, cookie, expect = [], absent = []) {
  const res = await fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  const missing = [].concat(expect).filter((e) => !body.includes(e));
  const present = [].concat(absent).filter((a) => body.includes(a));
  ok(`page ${path}`, res.status === 200 && !missing.length && !present.length, `${res.status}${missing.length ? `, absent : ${missing.join(" | ")}` : ""}${present.length ? `, présent : ${present.join(" | ")}` : ""}`);
  return body;
}

const [aicha, koffi, moussa, fatou, modo, mairie] = await Promise.all(["aicha", "koffi", "moussa", "fatou", "modo", "mairie"].map(login));

// Navigation par catégories, onglet en cours, Centrale dans la barre, bulle du Griot
const nav = await page("/radar", aicha.cookie, ["Échanger", "Construire", "Gagner", "Centrale d&#x27;achat", "Ouvrir le Griot et les discussions"]);
ok("l'onglet en cours est signalé (aria-current)", /aria-current="page"[^>]*href="\/radar"|href="\/radar"[^>]*aria-current="page"/.test(nav) || nav.includes("Radar d&#x27;opportunités"));
await page("/moderation", modo.cookie, ["Administration", "Radar : opportunités à valider", "Traçabilité du cacao", "Collecter les flux maintenant"]);
await page("/griot?q=FedaPay", aicha.cookie, "Le Griot");

// Markdown : éditeur à la publication d'une question et d'un projet, rendu enrichi
await page("/questions/new", aicha.cookie, ["Aperçu", "Liste numérotée", "Bloc de code"]);
await page("/showroom/new", aicha.cookie, ["Aperçu", "Je cherche des collaborateurs"], ["contributeurs"]);
const { data: project } = await admin.from("projects").select("id, slug").limit(1).single();
await admin.from("projects").update({ description: "## Le problème\nPayer au **marché**, *sans* smartphone.\n\n1. USSD\n2. Mobile Money\n\n[Démo](https://exemple.org)" }).eq("id", project.id);
const showroom = await page(`/showroom/${project.slug}`, aicha.cookie, ["<h3", "<strong>marché</strong>", "<em>sans</em>", "<ol", 'href="https://exemple.org"']);
ok("pas de Markdown brut dans la fiche projet", !showroom.includes(">## Le problème"));
await page("/showroom", aicha.cookie, "Le problème Payer au marché", "## Le problème");
await admin.from("projects").update({ description: "[piège](javascript:alert(1))" }).eq("id", project.id);
await page(`/showroom/${project.slug}`, aicha.cookie, "piège", 'href="javascript:');

// Discussions : relations, sujet programmé, invitations, partage
const { data: relations } = await koffi.c.rpc("my_relations");
ok("relations de Koffi (messages privés ou Squads)", (relations?.length ?? 0) > 0, relations?.map((r) => r.username).join(", "));
const later = new Date(Date.now() + 2 * 3600_000).toISOString();
const { data: topic, error: eTopic } = await koffi.c.rpc("create_topic", { p_title: "Live : migrer vers Laravel 11", p_description: "Questions en direct", p_tags: ["Laravel"], p_scheduled_at: later });
ok("Koffi programme un sujet", !eTopic, eTopic?.message);
const { error: ePast } = await koffi.c.rpc("create_topic", { p_title: "Sujet dans le passé", p_description: "", p_tags: [], p_scheduled_at: "2020-01-01T10:00:00Z" });
ok("une date passée est refusée", !!ePast);
const { error: eEarly } = await aicha.c.from("messages").insert({ conversation_id: topic, author_id: aicha.id, body: "Je suis là en avance !" });
ok("sujet programmé : fermé aux messages avant l'heure", !!eEarly && /ouvre le/.test(eEarly.message), eEarly?.message);
const { error: eOwner } = await koffi.c.from("messages").insert({ conversation_id: topic, author_id: koffi.id, body: "Bienvenue, on commence à l'heure." });
ok("son créateur peut préparer un message d'accueil", !eOwner, eOwner?.message);
const { error: eNotMember } = await moussa.c.rpc("invite_to_topic", { p_conversation: topic, p_users: [fatou.id] });
ok("seul un membre invite", !!eNotMember);
const { data: invited, error: eInvite } = await koffi.c.rpc("invite_to_topic", { p_conversation: topic, p_users: [aicha.id, fatou.id, koffi.id] });
ok("Koffi invite deux relations (pas lui-même)", !eInvite && invited === 2, eInvite?.message ?? String(invited));
const { data: again } = await koffi.c.rpc("invite_to_topic", { p_conversation: topic, p_users: [aicha.id] });
ok("pas de double invitation", again === 0);
const { data: inviteNotif } = await admin.from("notifications").select("payload").eq("user_id", aicha.id).eq("kind", "topic_invite");
ok("Aïcha est notifiée de l'invitation (sujet programmé)", inviteNotif?.some((n) => n.payload.conversation_id === topic && n.payload.scheduled_at));
await page(`/discussions/${topic}`, aicha.cookie, ["Sujet programmé", "Partager le sujet", "Inviter des relations", "Copier"]);
await page(`/discussions/${topic}`, null, ["Live : migrer vers Laravel 11", "Partager le sujet"]);
await page("/discussions?onglet=sujets", aicha.cookie, "programmé ·");
await page("/discussions/new", koffi.cookie, ["Instantané", "Programmé", "Inviter des relations"]);
// L'heure arrive : les membres sont prévenus une seule fois
await admin.from("conversations").update({ scheduled_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", topic);
const { data: started } = await admin.rpc("start_scheduled_topics");
ok("à l'heure dite, les 3 membres sont prévenus", started === 3, String(started));
const { data: startedAgain } = await admin.rpc("start_scheduled_topics");
ok("une seule fois", startedAgain === 0);
const { error: eOpen } = await aicha.c.from("messages").insert({ conversation_id: topic, author_id: aicha.id, body: "C'est parti !" });
ok("le sujet est ouvert à l'heure dite", !eOpen, eOpen?.message);
const { data: instant } = await fatou.c.rpc("create_topic", { p_title: "Sujet instantané", p_description: "", p_tags: [] });
const { error: eInstant } = await moussa.c.from("messages").insert({ conversation_id: instant, author_id: moussa.id, body: "Premier !" });
ok("un sujet instantané est ouvert tout de suite", !eInstant, eInstant?.message);

// Radar : validation par l'administration, échéances imminentes
const PENDING = "a2000000-0000-4000-8000-000000000005";
const IMMINENT = "a2000000-0000-4000-8000-000000000004";
await page("/radar", aicha.cookie, ["Échéances imminentes", "Portail de suivi des permis", 'aria-live="polite"'], "Traçabilité du cacao");
const { data: hidden } = await fatou.c.from("opportunities").select("id").eq("id", PENDING);
ok("appel d'offres non validé : invisible", hidden?.length === 0);
const { error: eRejectNoNote } = await modo.c.rpc("review_opportunity", { p_opportunity: IMMINENT, p_approve: true, p_note: "" });
ok("on ne revalide pas une opportunité déjà publiée", !!eRejectNoNote);
const { error: eApprove } = await modo.c.rpc("review_opportunity", { p_opportunity: PENDING, p_approve: true, p_note: "" });
ok("l'administration valide l'appel d'offres", !eApprove, eApprove?.message);
const { data: visible } = await fatou.c.from("opportunities").select("status, reviewed_by").eq("id", PENDING).single();
ok("il devient public", visible?.status === "open" && visible.reviewed_by === modo.id);
const { data: draft } = await mairie.c
  .from("opportunities")
  .insert({ source: "publiee", publisher_id: mairie.id, organization_name: "Mairie de Cotonou", title: "Site des marchés publics", raw_text: "Un site web pour publier les marchés publics de la ville.", need: "Site web", status: "draft" })
  .select("id")
  .single();
const { error: eSubmit } = await mairie.c.from("opportunities").update({ status: "pending" }).eq("id", draft.id);
ok("l'organisation envoie en validation", !eSubmit, eSubmit?.message);
const { error: eForce } = await mairie.c.from("opportunities").update({ status: "open" }).eq("id", draft.id);
ok("…mais ne peut pas publier elle-même", !!eForce);
await modo.c.rpc("review_opportunity", { p_opportunity: draft.id, p_approve: false, p_note: "Budget et date limite manquants" });
const { data: refused } = await admin.from("notifications").select("payload").eq("user_id", mairie.id).eq("kind", "opportunity_reviewed");
ok("refus motivé transmis à l'organisation", refused?.some((n) => n.payload.opportunity_id === draft.id && n.payload.note === "Budget et date limite manquants"));
await page("/radar", mairie.cookie, ["Mes publications non encore visibles", "refusée : Budget et date limite manquants"]);
await admin.from("opportunities").update({ deadline: "2020-01-01" }).eq("id", IMMINENT);
const { data: closedCount } = await admin.rpc("close_expired_opportunities");
ok("échéance dépassée : opportunité close automatiquement", closedCount >= 1);
await page("/radar", aicha.cookie, [], "Portail de suivi des permis");

// Forensic : « Lancer l'audit », accord signé, PDF pour les deux parties
await page("/forensic", aicha.cookie, "Lancer l&#x27;audit");
await page("/forensic/new", aicha.cookie, ["Lancer l&#x27;audit", "accord de confidentialité généré automatiquement"]);
const { data: audit } = await admin.from("audits").select("id, owner_id").like("title", "Tontine Pay%").single();
const { data: koffiNda } = await admin.from("audit_auditors").select("nda_signed_name, nda_hash, nda_version").eq("audit_id", audit.id).eq("auditor_id", koffi.id).single();
ok("accord signé : nom, version et empreinte SHA-256", koffiNda?.nda_signed_name === "Koffi Kouassi" && /^[0-9a-f]{64}$/.test(koffiNda.nda_hash ?? "") && koffiNda.nda_version === "nda-2026-11");
const { data: ndaNotifs } = await admin.from("notifications").select("user_id").eq("kind", "audit_nda_signed").contains("payload", { audit_id: audit.id });
ok("les deux parties reçoivent l'accord", ndaNotifs?.some((n) => n.user_id === audit.owner_id) && ndaNotifs.some((n) => n.user_id === koffi.id));
await admin.from("profiles").update({ xp: 2500 }).eq("id", fatou.id);
await page(`/forensic/${audit.id}`, fatou.cookie, ["Signature : ton nom complet", "Article 8 – Preuve et droit applicable", "Signer l&#x27;accord et rejoindre l&#x27;audit"]);
await page(`/forensic/${audit.id}`, aicha.cookie, "Accord signé (PDF)");
const pdfUrl = `${APP}/api/forensic/${audit.id}/accord/${koffi.id}`;
for (const [who, user] of [["le porteur", aicha], ["l'auditeur", koffi]]) {
  const res = await fetch(pdfUrl, { headers: { cookie: user.cookie } });
  const bytes = Buffer.from(await res.arrayBuffer());
  const text = bytes.toString("latin1");
  ok(`${who} télécharge le PDF signé`, res.status === 200 && res.headers.get("content-type") === "application/pdf" && text.startsWith("%PDF-1.4") && text.trimEnd().endsWith("%%EOF"), `${res.status}`);
  if (user === aicha) {
    ok("le PDF contient la signature et l'empreinte", text.includes("Koffi Kouassi") && text.includes(koffiNda.nda_hash) && text.includes("Article 8"));
    const xref = Number(text.match(/startxref\n(\d+)/)?.[1]);
    ok("table des références du PDF valide", text.slice(xref, xref + 4) === "xref");
  }
}
const spy = await fetch(pdfUrl, { headers: { cookie: moussa.cookie } });
ok("un tiers ne peut pas lire l'accord", spy.status === 403, String(spy.status));
const anon = await fetch(pdfUrl);
ok("sans connexion non plus", anon.status === 401, String(anon.status));
const { error: eNoName } = await fatou.c.rpc("join_audit", { p_audit: audit.id, p_accept_nda: true, p_signed_name: " " });
ok("signature obligatoire pour rejoindre", !!eNoName);

// Photo de profil professionnelle
await page("/parametres", aicha.cookie, ["Photo de profil professionnelle", "Ajouter une photo"]);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const { error: eUp } = await aicha.c.storage.from("avatars").upload(`${aicha.id}/photo.png`, png, { contentType: "image/png" });
ok("Aïcha dépose sa photo", !eUp, eUp?.message);
const { error: eSpyUp } = await aicha.c.storage.from("avatars").upload(`${koffi.id}/photo.png`, png, { contentType: "image/png" });
ok("impossible de déposer dans le dossier d'un autre", !!eSpyUp);
const { error: eSvg } = await aicha.c.storage.from("avatars").upload(`${aicha.id}/x.svg`, Buffer.from("<svg/>"), { contentType: "image/svg+xml" });
ok("seules les images JPEG, PNG ou WebP sont acceptées", !!eSvg);

// Vocabulaire
const { data: roles } = await admin.from("squads").select("roles_needed");
ok("plus de rôle « Contributeur » dans les Squads", !roles?.some((r) => r.roles_needed.includes("Contributeur")));

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
