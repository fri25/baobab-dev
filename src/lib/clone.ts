import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { embed, hasAnthropicCredentials } from "@/lib/griot";

// Clone IA du senior (§6.2) : répond dans le style du senior, uniquement à partir de ses contenus.

export type CloneSource = { id: string; title: string; content: string; rank: number };
export type CloneAnswer = {
  queryId: string;
  status: "answered" | "out_of_scope" | "no_source";
  answer: string;
  sources: { id: string; title: string }[];
  billing: string;
  price: number;
};
export class CloneError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Clone = { id: string; owner_id: string; name: string; specialty: string; style_notes: string | null; status: string; owner: { username: string; full_name: string | null } };

export async function embedCloneSource(sourceId: string, title: string, content: string) {
  const vector = await embed(`${title}\n${content}`, "document");
  if (vector) await createAdminClient().from("clone_sources").update({ embedding: JSON.stringify(vector) }).eq("id", sourceId);
}

async function findSources(cloneId: string, question: string): Promise<CloneSource[]> {
  const admin = createAdminClient();
  const vector = await embed(question, "query");
  if (vector) {
    const { data } = await admin.rpc("match_clone_sources", { p_clone: cloneId, query_embedding: JSON.stringify(vector), match_count: 4 });
    if (data?.length) return data;
  }
  const { data } = await admin.rpc("match_clone_sources_text", { p_clone: cloneId, p_query: question, match_count: 4 });
  return data ?? [];
}

function systemPrompt(clone: Clone) {
  const senior = clone.owner.full_name ?? clone.owner.username;
  return `Tu es le clone IA de ${senior} (@${clone.owner.username}) sur Baobab Dev. Spécialité : ${clone.specialty}.
Tu n'es pas ${senior} : tu es une IA entraînée sur ses contenus, et tu le dis si on te le demande.
Réponds comme ${senior} le ferait, avec ses méthodes et son ton${clone.style_notes ? ` (${clone.style_notes})` : ""}, mais UNIQUEMENT à partir des contenus fournis dans <contenus>. N'invente rien.
Cite chaque contenu utilisé avec son numéro entre crochets, par exemple [1].
Si la question sort de ta spécialité, réponds exactement : HORS_DOMAINE
Si les contenus ne suffisent pas pour répondre, réponds exactement : SANS_SOURCE
Réponds en français, de façon concise (moins de 200 mots), lisible sur un téléphone. Garde les extraits de code utiles.`;
}

async function synthesize(clone: Clone, question: string, sources: CloneSource[]) {
  const client = new Anthropic();
  const xml = sources.map((s, i) => `<contenu id="${i + 1}" titre="${s.title}">\n${s.content}\n</contenu>`).join("\n");
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: systemPrompt(clone),
    messages: [{ role: "user", content: `<contenus>\n${xml}\n</contenus>\n\nQuestion : ${question}` }],
  });
  if (response.stop_reason === "refusal") return null;
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export async function askClone(cloneId: string, userId: string, question: string): Promise<CloneAnswer> {
  const admin = createAdminClient();
  const { data: clone } = await admin
    .from("ai_clones")
    .select("id, owner_id, name, specialty, style_notes, status, owner:profiles!ai_clones_owner_id_fkey(username, full_name)")
    .eq("id", cloneId)
    .single<Clone>();
  if (!clone || (clone.status !== "published" && clone.owner_id !== userId)) throw new CloneError("Clone indisponible", 404);

  // Facturation vérifiée avant de solliciter l'IA
  const { data: bill } = await admin.rpc("clone_billing", { p_user: userId, p_clone: cloneId, p_question: question }).single<{ billing: string; price: number; balance: number }>();
  if (bill?.billing === "paid" && bill.balance < bill.price) {
    throw new CloneError(`Solde insuffisant : la question coûte ${bill.price} FCFA. Recharge ton portefeuille ou prends le Pass Clones.`, 402);
  }

  const senior = clone.owner.full_name ?? clone.owner.username;
  const sources = await findSources(cloneId, question);
  let status: CloneAnswer["status"] = "answered";
  let answer: string | null = null;
  let cited: CloneSource[] = [];

  if (sources.length === 0) {
    status = "no_source";
  } else if (hasAnthropicCredentials()) {
    try {
      answer = await synthesize(clone, question, sources);
    } catch (error) {
      console.error("Clone IA : échec de la synthèse, repli extractif", error);
    }
    if (answer === "HORS_DOMAINE") status = "out_of_scope";
    else if (answer === "SANS_SOURCE") status = "no_source";
    else if (answer) {
      const ids = new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
      cited = sources.filter((_, i) => ids.has(i + 1));
      if (cited.length === 0) answer = null; // jamais de réponse sans contenu du senior
    }
  }

  if (status === "answered" && !answer) {
    // Repli extractif : les contenus du senior les plus proches, cités
    cited = sources.slice(0, 2);
    answer = cited
      .map((s, i) => `**${s.title}** [${i + 1}]\n\n${s.content.length > 700 ? `${s.content.slice(0, 700)}…` : s.content}`)
      .join("\n\n");
    answer = `Voici ce que ${senior} a écrit sur le sujet :\n\n${answer}`;
  }

  if (status === "answered" && answer) {
    // Renumérote les citations dans l'ordre des sources affichées
    const order = cited.map((c) => sources.indexOf(c) + 1);
    answer = answer.replace(/\[(\d+)\]/g, (m, n) => {
      const idx = order.indexOf(Number(n));
      return idx >= 0 ? `[${idx + 1}]` : m;
    });
  }

  const finalAnswer =
    status === "out_of_scope"
      ? `Cette question sort de ma spécialité (${clone.specialty}). Pose-la au Griot ou à un autre clone : elle ne t'est pas facturée.`
      : status === "no_source"
        ? `${senior} n'a encore rien écrit sur ce sujet, et je n'invente rien. Tu peux lui écrire directement ou réserver une session de mentorat : la question ne t'est pas facturée.`
        : answer!;

  const { data: queryId, error } = await admin.rpc("record_clone_query", {
    p_user: userId,
    p_clone: cloneId,
    p_question: question,
    p_answer: finalAnswer,
    p_status: status,
    p_cited: cited.map((c) => c.id),
  });
  if (error) throw new CloneError(error.message, 400);

  const billing = status === "answered" ? (bill?.billing ?? "paid") : "not_billed";
  return {
    queryId: queryId as string,
    status,
    answer: finalAnswer,
    sources: cited.map((c) => ({ id: c.id, title: c.title })),
    billing,
    price: billing === "paid" ? (bill?.price ?? 0) : 0,
  };
}
