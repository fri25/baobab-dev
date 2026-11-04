// Images dans les questions : stockage, droits, affichage
import { createRequire } from "node:module";
import fs from "node:fs";

const appDir = process.argv[2] ?? process.cwd();
const require = createRequire(`${appDir}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const env = Object.fromEntries(
  fs.readFileSync(`${appDir}/.env.local`, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
let failures = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};
async function login(user) {
  const c = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({ email: `${user}@baobab.dev`, password: "baobab2026" });
  const ref = new URL(URL_).hostname.split(".")[0];
  return { c, id: data.user.id, cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}` };
}

// PNG 1×1 valide
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const aicha = await login("aicha");
const koffi = await login("koffi");
const bucket = (u) => u.c.storage.from("question-images");

const path = `${aicha.id}/${crypto.randomUUID()}.png`;
const { error: e1 } = await bucket(aicha).upload(path, png, { contentType: "image/png" });
ok("Aïcha envoie une image dans son dossier", !e1, e1?.message);

const { error: e2 } = await bucket(aicha).upload(`${koffi.id}/intrus.png`, png, { contentType: "image/png" });
ok("impossible d'écrire dans le dossier d'un autre", !!e2, e2?.message);

const { error: e3 } = await bucket(aicha).upload(`${aicha.id}/script.html`, Buffer.from("<script>alert(1)</script>"), { contentType: "text/html" });
ok("seules les images sont acceptées", !!e3, e3?.message);

const { error: e4 } = await bucket(aicha).upload(`${aicha.id}/lourde.png`, Buffer.alloc(1100 * 1024), { contentType: "image/png" });
ok("1 Mo maximum par image", !!e4, e4?.message);

const url = bucket(aicha).getPublicUrl(path).data.publicUrl;
const res = await fetch(url);
ok("image publique lisible", res.ok && res.headers.get("content-type")?.startsWith("image/"), `${res.status}`);

const { error: e5 } = await bucket(koffi).remove([path]);
const still = await fetch(url);
ok("un autre utilisateur ne peut pas la supprimer", still.ok, e5?.message);

const { data: q, error: e6 } = await aicha.c
  .from("questions")
  .insert({ author_id: aicha.id, title: "Erreur 419 sur le webhook, capture jointe", body: "Voir la capture.", tags: ["Laravel"], images: [url] })
  .select("id")
  .single();
ok("question avec image", !e6, e6?.message);
const { error: e7 } = await aicha.c
  .from("questions")
  .insert({ author_id: aicha.id, title: "Trop d'images dans cette question", body: "x", images: [url, url, url, url, url] });
ok("4 images maximum par question", !!e7);

const html = await (await fetch(`http://localhost:3000/questions/${q.id}`)).text();
ok("image affichée sur la page", html.includes(url) && html.includes('loading="lazy"'));
const lite = await (await fetch(`http://localhost:3000/questions/${q.id}`, { headers: { cookie: "lite=1" } })).text();
ok("mode données réduites : lien de remplacement", lite.includes("data-lite") && lite.includes("Afficher l"));
// Réponses avec images
const { data: ans, error: e8 } = await koffi.c
  .from("answers")
  .insert({ question_id: q.id, author_id: koffi.id, body: "Exclue la route du CSRF, voir capture.", images: [url] })
  .select("id")
  .single();
ok("réponse avec image", !e8, e8?.message);
const { error: e9 } = await koffi.c
  .from("answers")
  .insert({ question_id: q.id, author_id: koffi.id, body: "x", images: [url, url, url, url, url] });
ok("4 images maximum par réponse", !!e9);
const withAnswer = await (await fetch(`http://localhost:3000/questions/${q.id}`, { headers: { cookie: koffi.cookie } })).text();
ok("image de la réponse affichée", withAnswer.includes("jointe à la réponse") && Boolean(ans));
ok("formulaire de réponse avec ajout d'images", withAnswer.includes("Images (facultatif)"));

const list = await (await fetch("http://localhost:3000/questions")).text();
ok("indicateur d'images dans la liste", list.includes("🖼"));

console.log(failures ? `\n${failures} échec(s)` : "\nTout passe.");
process.exit(failures ? 1 : 0);
