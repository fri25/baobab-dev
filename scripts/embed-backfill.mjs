// Calcule les empreintes sémantiques (Voyage) des contenus qui n'en ont pas encore :
// réponses (le Griot) et sources des clones IA. À lancer après un `db:reset` ou l'ajout de VOYAGE_API_KEY.
//   npm run embed:backfill
import { createRequire } from "node:module";
import fs from "node:fs";

const appDir = process.cwd();
const require = createRequire(`${appDir}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const env = Object.fromEntries(
  fs.readFileSync(`${appDir}/.env.local`, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
if (!env.VOYAGE_API_KEY) {
  console.log("VOYAGE_API_KEY absente de .env.local : rien à faire (la recherche plein texte reste utilisée).");
  process.exit(0);
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Sans moyen de paiement, Voyage limite à 3 requêtes par minute : on patiente puis on réessaie
async function embedBatch(texts) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.VOYAGE_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ input: texts, model: "voyage-3.5", input_type: "document", output_dimension: 1024 }),
    });
    if (res.ok) return (await res.json()).data.map((d) => d.embedding);
    if (res.status !== 429 || attempt >= 6) throw new Error(`Voyage ${res.status} : ${await res.text()}`);
    console.log("Limite Voyage atteinte, nouvel essai dans 20 s…");
    await new Promise((r) => setTimeout(r, 20_000));
  }
}

async function backfill(table, toText) {
  const { data: rows, error } = await admin.from(table).select("*").is("embedding", null).limit(1000);
  if (error) throw new Error(`${table} : ${error.message}`);
  let done = 0;
  for (let i = 0; i < rows.length; i += 64) {
    const batch = rows.slice(i, i + 64);
    const vectors = await embedBatch(batch.map(toText));
    for (const [j, row] of batch.entries()) {
      const { error: e } = await admin.from(table).update({ embedding: JSON.stringify(vectors[j]) }).eq("id", row.id);
      if (e) throw new Error(`${table} ${row.id} : ${e.message}`);
      done++;
    }
  }
  console.log(`${table} : ${done} empreinte(s) calculée(s)`);
}

await backfill("answers", (a) => a.body);
await backfill("clone_sources", (s) => `${s.title ?? ""}\n${s.content}`);
