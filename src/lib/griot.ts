import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const GRIOT_DAILY_QUOTA = 20;

export type GriotSource = {
  answer_id: string;
  question_id: string;
  question_title: string;
  body: string;
  author_id: string;
  author_username: string;
  author_city: string | null;
  author_country: string | null;
  similarity: number;
};

export type GriotResult = {
  queryId: string;
  status: "answered" | "no_source";
  answer: string;
  sources: GriotSource[]; // uniquement les sources effectivement citées
};

// Embeddings Voyage (1024 dimensions, cf. migration). Sans clé : recherche plein texte.
export async function embed(text: string, inputType: "query" | "document") {
  if (!process.env.VOYAGE_API_KEY) return null;
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: [text], model: "voyage-3.5", input_type: inputType, output_dimension: 1024 }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

export async function embedAnswer(answerId: string, text: string) {
  const vector = await embed(text, "document");
  if (vector) await createAdminClient().from("answers").update({ embedding: JSON.stringify(vector) }).eq("id", answerId);
}

async function findSources(question: string): Promise<GriotSource[]> {
  const admin = createAdminClient();
  const vector = await embed(question, "query");
  if (vector) {
    const { data } = await admin.rpc("match_answers", { query_embedding: JSON.stringify(vector), match_count: 5 });
    if (data?.length) return data;
  }
  const { data } = await admin.rpc("match_answers_text", { p_query: question, match_count: 5 });
  return data ?? [];
}

const SYSTEM = `Tu es le Griot de Baobab Dev, l'IA communautaire des développeurs africains.
Tu réponds UNIQUEMENT à partir des réponses de la communauté fournies dans <sources>. N'ajoute aucune information qui n'y figure pas.
Chaque affirmation doit être suivie du numéro de sa source entre crochets, par exemple [1] ou [2].
Nomme les auteurs que tu cites (ex. « Comme l'explique Koffi d'Abidjan [1] »).
Si les sources ne répondent pas à la question, réponds exactement : AUCUNE_SOURCE
Réponds en français, de façon concise (moins de 180 mots), lisible sur un téléphone. Garde les extraits de code utiles.`;

async function synthesize(question: string, sources: GriotSource[]) {
  const client = new Anthropic();
  const sourcesXml = sources
    .map(
      (s, i) =>
        `<source id="${i + 1}" auteur="${s.author_username}" ville="${s.author_city ?? ""}" question="${s.question_title}">\n${s.body}\n</source>`,
    )
    .join("\n");

  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" }, // objectif : réponse en moins de 8 s (§9)
    system: SYSTEM,
    messages: [{ role: "user", content: `<sources>\n${sourcesXml}\n</sources>\n\nQuestion : ${question}` }],
  });
  if (response.stop_reason === "refusal") return null;
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// Repli sans clé d'API : synthèse extractive, toujours sourcée
function extractive(sources: GriotSource[]) {
  const top = sources.slice(0, 2);
  return top
    .map((s, i) => {
      const excerpt = s.body.length > 600 ? `${s.body.slice(0, 600)}…` : s.body;
      return `**${s.author_username}${s.author_city ? ` (${s.author_city})` : ""}** a répondu à « ${s.question_title} » [${i + 1}] :\n\n${excerpt}`;
    })
    .join("\n\n");
}

export const hasAnthropicCredentials = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function askGriot(question: string, userId: string | null, channel: "app" | "whatsapp"): Promise<GriotResult> {
  const admin = createAdminClient();
  const sources = await findSources(question);

  let answer: string | null = null;
  let cited: GriotSource[] = [];

  if (sources.length > 0) {
    if (hasAnthropicCredentials()) {
      try {
        answer = await synthesize(question, sources);
      } catch (error) {
        console.error("Griot : échec de la synthèse, repli extractif", error);
      }
    }
    if (answer && answer !== "AUCUNE_SOURCE") {
      const ids = new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
      cited = sources.filter((_, i) => ids.has(i + 1));
    }
    // Exigence clé : 100 % des réponses sourcées. Sans citation valide, on repasse en extractif.
    if (!answer || answer === "AUCUNE_SOURCE" || cited.length === 0) {
      if (answer === "AUCUNE_SOURCE") {
        answer = null;
      } else {
        answer = extractive(sources);
        cited = sources.slice(0, 2);
      }
    }
  }

  const status = answer ? "answered" : "no_source";
  const finalAnswer =
    answer ??
    "Je n'ai trouvé aucune réponse validée par la communauté sur ce sujet, et je n'invente rien. Publie ta question : les experts de ces technologies seront notifiés.";

  const { data: query } = await admin
    .from("griot_queries")
    .insert({ user_id: userId, channel, question, answer: finalAnswer, status })
    .select("id")
    .single();

  // Chaque citation rapporte +5 XP à son auteur (trigger SQL)
  if (query && cited.length > 0) {
    await admin
      .from("griot_citations")
      .insert(cited.map((s) => ({ query_id: query.id, answer_id: s.answer_id, author_id: s.author_id })));
  }

  // Renumérote pour que [n] corresponde à l'ordre des sources affichées
  let rendered = finalAnswer;
  if (answer) {
    const order = cited.map((c) => sources.indexOf(c) + 1);
    rendered = finalAnswer.replace(/\[(\d+)\]/g, (_, n) => {
      const idx = order.indexOf(Number(n));
      return idx >= 0 ? `[${idx + 1}]` : "";
    });
  }

  return { queryId: query?.id ?? "", status, answer: rendered, sources: cited };
}
