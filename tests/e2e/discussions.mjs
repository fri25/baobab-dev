// Discussions : messages privés, sujets publics, temps réel, mentions, blocage, modération
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
  await c.realtime.setAuth(data.session.access_token);
  const ref = new URL(URL_).hostname.split(".")[0];
  return { c, id: data.user.id, cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}` };
}
async function page(path, cookie, expect, status = 200) {
  const res = await fetch(APP + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  const found = expect ? body.includes(expect) : true;
  ok(`page ${path}`, res.status === status && found, `${res.status}${expect && !found ? `, « ${expect} » absent` : ""}`);
}

const [aicha, koffi, moussa, fatou, ibrahim, modo] = await Promise.all(["aicha", "koffi", "moussa", "fatou", "ibrahim", "modo"].map(login));
const TOPIC = "e1000000-0000-4000-8000-000000000001"; // Paiements Mobile Money
const FLUTTER = "e1000000-0000-4000-8000-000000000003";
const { data: dm } = await admin.from("conversations").select("id").eq("kind", "direct").single();

// Pages
await page("/discussions", aicha.cookie, "Koffi Kouassi");
await page("/discussions?onglet=sujets", null, "Paiements Mobile Money");
await page(`/discussions/${TOPIC}`, null, "client_reference");
await page(`/discussions/${dm.id}`, aicha.cookie, "Pair-Debugging");
await page(`/discussions/${dm.id}`, moussa.cookie, null, 404);
await page("/discussions/new", aicha.cookie, "Lancer un sujet");
await page("/u/koffi", aicha.cookie, "Envoyer un message");

// Non-lus
const { data: unread } = await aicha.c.rpc("unread_conversations_count");
// Non lus : la conversation privée avec Koffi et le sujet où Koffi lui a répondu
ok("Aïcha a des conversations non lues", unread === 2, `${unread}`);
const { data: convs } = await aicha.c.rpc("my_conversations");
const dmRow = convs.find((c) => c.kind === "direct");
ok("liste privée : interlocuteur et dernier message", dmRow?.other_username === "koffi" && dmRow?.unread === 1);
await aicha.c.rpc("mark_conversation_read", { p_conversation: dm.id });
ok("lu après ouverture", (await aicha.c.rpc("unread_conversations_count")).data === 1);

// Conversation privée
const { data: dm2 } = await moussa.c.rpc("get_or_create_direct", { p_other: fatou.id });
const { data: dm2bis } = await fatou.c.rpc("get_or_create_direct", { p_other: moussa.id });
ok("une seule conversation privée par paire", dm2 && dm2 === dm2bis);
const { error: eSelf } = await moussa.c.rpc("get_or_create_direct", { p_other: moussa.id });
ok("impossible de s'écrire à soi-même", !!eSelf);
const { data: spy } = await moussa.c.from("messages").select("id").eq("conversation_id", dm.id);
ok("RLS : Moussa ne lit pas les messages privés d'Aïcha et Koffi", spy?.length === 0);
const { error: eIntrude } = await moussa.c.from("messages").insert({ conversation_id: dm.id, author_id: moussa.id, body: "coucou" });
ok("RLS : Moussa ne peut pas écrire dans leur conversation", !!eIntrude, eIntrude?.message);

// Temps réel : Koffi reçoit le message d'Aïcha
const received = new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 8000);
  koffi.c
    .channel("test-dm")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${dm.id}` }, (p) => {
      clearTimeout(timer);
      resolve(p.new);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await new Promise((r) => setTimeout(r, 3000)); // le temps que Realtime s'abonne à la base
        await aicha.c.from("messages").insert({ conversation_id: dm.id, author_id: aicha.id, body: "Mercredi 18 h pour le Pair-Debugging ?" });
      }
    });
});
const live = await received;
ok("temps réel : Koffi reçoit le message instantanément", live?.body?.startsWith("Mercredi"));
await aicha.c.from("messages").insert({ conversation_id: dm.id, author_id: aicha.id, body: "Je t'envoie le lien." });
const { data: dmNotifs } = await admin.from("notifications").select("id").eq("user_id", koffi.id).eq("kind", "direct_message").is("read_at", null);
ok("une seule notification pour plusieurs messages non lus", dmNotifs?.length === 1, `${dmNotifs?.length}`);

// Sujets
const { error: eJoin } = await ibrahim.c.from("messages").insert({ conversation_id: FLUTTER, author_id: ibrahim.id, body: "Et pour iOS, une astuce équivalente ?" });
const { data: joined } = await admin.from("conversation_members").select("user_id").eq("conversation_id", FLUTTER).eq("user_id", ibrahim.id);
ok("écrire dans un sujet le rejoint automatiquement", !eJoin && joined?.length === 1, eJoin?.message);
await moussa.c.from("messages").insert({ conversation_id: TOPIC, author_id: moussa.id, body: "@koffi tu as un exemple de lien de paiement CinetPay ?" });
const { data: mention } = await admin.from("notifications").select("payload").eq("user_id", koffi.id).eq("kind", "mention");
ok("@mention : Koffi notifié", mention?.some((n) => n.payload.from === "moussa"));
const { data: topicId, error: eTopic } = await fatou.c.rpc("create_topic", { p_title: "Hébergement pas cher en FCFA", p_description: "VPS, Mobile Money", p_tags: ["hébergement"] });
ok("créer un sujet", !eTopic && !!topicId, eTopic?.message);
await page(`/discussions/${topicId}`, null, "Hébergement pas cher");

// Demande d'avis du Griot : sujet public et notification in-app à un expert compétent
const { data: griotQuery, error: griotQueryError } = await admin
  .from("griot_queries")
  .insert({
    user_id: aicha.id,
    channel: "app",
    question: "Comment intégrer Laravel avec un webhook de paiement ?",
    answer: "Vérifie la signature du webhook avant de traiter le paiement.",
    status: "answered",
  })
  .select("id")
  .single();
const { data: reviewRows, error: reviewError } = griotQuery
  ? await aicha.c.rpc("request_griot_review", { p_query_id: griotQuery.id, p_tags: ["Laravel"] })
  : { data: null, error: griotQueryError };
const review = reviewRows?.[0];
ok("demande du Griot : sujet public créé", !reviewError && !!review?.conversation_id, reviewError?.message);
if (review?.conversation_id) {
  const { data: expertNotification } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", koffi.id)
    .eq("kind", "griot_review")
    .eq("payload->>conversation_id", review.conversation_id);
  ok("demande du Griot : Koffi reçoit une notification d'expert", expertNotification?.length === 1);
  const { data: publicThread } = await moussa.c
    .from("conversations")
    .select("id")
    .eq("id", review.conversation_id)
    .single();
  const { data: reviewMessage } = await moussa.c
    .from("messages")
    .select("body")
    .eq("conversation_id", review.conversation_id)
    .single();
  ok("demande du Griot : sujet et échange visibles publiquement", !!publicThread && reviewMessage?.body.includes("webhook de paiement"));

  const { data: retryRows, error: retryError } = await aicha.c.rpc("request_griot_review", {
    p_query_id: griotQuery.id,
    p_tags: ["Laravel"],
  });
  ok("demande du Griot : un nouvel essai réutilise le même sujet", !retryError && retryRows?.[0]?.conversation_id === review.conversation_id);
}
await ibrahim.c.rpc("leave_topic", { p_conversation: FLUTTER });
const { data: left } = await admin.from("conversation_members").select("user_id").eq("conversation_id", FLUTTER).eq("user_id", ibrahim.id);
ok("quitter un sujet", left?.length === 0);

// Suppression et modération
const { data: mine } = await fatou.c.from("messages").insert({ conversation_id: topicId, author_id: fatou.id, body: "Message à supprimer" }).select("id").single();
const { error: eDelOther } = await moussa.c.rpc("delete_message", { p_message_id: mine.id });
ok("on ne supprime pas le message d'un autre", !!eDelOther);
await fatou.c.rpc("delete_message", { p_message_id: mine.id });
const { data: deleted } = await admin.from("messages").select("body, deleted_at").eq("id", mine.id).single();
ok("suppression de son propre message", deleted.deleted_at && deleted.body === "[message supprimé]");
const { data: spam } = await moussa.c.from("messages").insert({ conversation_id: TOPIC, author_id: moussa.id, body: "Achetez mes formations !!!" }).select("id").single();
const { error: eRep } = await aicha.c.from("reports").insert({ reporter_id: aicha.id, target_type: "message", target_id: String(spam.id), reason: "Spam" });
ok("signaler un message", !eRep, eRep?.message);
const { data: report } = await admin.from("reports").select("id").eq("target_type", "message").single();
const { error: eMod } = await modo.c.rpc("moderate_report", { p_report_id: report.id, p_action: "remove" });
const { data: moderated } = await admin.from("messages").select("body").eq("id", spam.id).single();
ok("la modération retire le message", !eMod && moderated.body.includes("modération"), eMod?.message);
await page("/moderation", modo.cookie, "Signalements");

// Blocage
await koffi.c.from("user_blocks").insert({ blocker_id: koffi.id, blocked_id: moussa.id });
const { error: eBlocked } = await moussa.c.rpc("get_or_create_direct", { p_other: koffi.id });
ok("un dev bloqué ne peut plus écrire en privé", !!eBlocked, eBlocked?.message);

// Anti-spam
let limited = null;
for (let i = 0; i < 22 && !limited; i++) {
  const { error } = await ibrahim.c.from("messages").insert({ conversation_id: topicId, author_id: ibrahim.id, body: `test ${i}` });
  if (error) limited = error.message;
}
ok("anti-spam : 20 messages par minute maximum", limited?.includes("20 messages"), limited);

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
