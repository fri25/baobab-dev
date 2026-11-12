import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { hasAnthropicCredentials } from "@/lib/griot";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/whatsapp";

// Radar d'opportunités cachées (§7.4) : extraction du besoin, collecte, correspondance et alertes.

export type Extracted = {
  title: string;
  organization_name: string | null;
  org_type: "pme" | "ong" | "collectivite" | "startup" | "entreprise";
  need: string;
  technologies: string[];
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null; // AAAA-MM-JJ
  country: string | null;
  city: string | null;
};

const COUNTRIES = ["Bénin", "Côte d'Ivoire", "Sénégal", "Togo", "Burkina Faso", "Mali", "Niger", "Cameroun", "Ghana", "Nigeria", "Guinée", "Kenya", "Rwanda", "Gabon"];
const CITIES: Record<string, string> = {
  Cotonou: "Bénin", "Porto-Novo": "Bénin", Parakou: "Bénin", Abidjan: "Côte d'Ivoire", Bouaké: "Côte d'Ivoire", Yamoussoukro: "Côte d'Ivoire",
  Dakar: "Sénégal", Thiès: "Sénégal", "Saint-Louis": "Sénégal", Lomé: "Togo", Ouagadougou: "Burkina Faso", "Bobo-Dioulasso": "Burkina Faso",
  Bamako: "Mali", Niamey: "Niger", Douala: "Cameroun", Yaoundé: "Cameroun", Accra: "Ghana", Lagos: "Nigeria", Conakry: "Guinée",
  Nairobi: "Kenya", Kigali: "Rwanda", Libreville: "Gabon",
};
// Besoins exprimés en langage courant → technologies du référentiel
const NEED_TECH: [RegExp, string[]][] = [
  [/mobile\s?money|orange money|\bwave\b|momo|moov money/i, ["Mobile Money"]],
  [/\bussd\b/i, ["USSD"]],
  [/fedapay/i, ["FedaPay"]],
  [/kkiapay/i, ["Kkiapay"]],
  [/cinetpay/i, ["CinetPay"]],
  [/application mobile|appli(cation)? (android|ios)|smartphone|hors[- ]ligne|hors connexion/i, ["Flutter"]],
  [/site (web|internet)|plateforme web|portail|e-?commerce|boutique en ligne/i, ["JavaScript", "React"]],
  [/base de donn[ée]es/i, ["PostgreSQL"]],
];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DIGITAL = /informatique|logiciel|application|site (web|internet)|plateforme|num[ée]rique|digital|d[ée]veloppement|syst[eè]me d'information|base de donn[ée]es|mobile money|ussd|sms/i;

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function knownSkills() {
  const { data } = await createAdminClient().from("skills").select("name");
  return (data ?? []).map((s) => s.name as string);
}

function parseAmount(raw: string, unit?: string) {
  const n = Number(raw.replace(/[\s.](?=\d{3}\b)/g, "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(/million/i.test(unit ?? "") ? n * 1_000_000 : n);
}

// Extraction par règles : sans clé d'API, ou en repli
export function extractByRules(raw: string, skills: string[]): Extracted {
  const text = raw.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const technologies = new Set<string>();
  for (const skill of skills) {
    if (new RegExp(`(^|[^\\w])${skill.replace(/[.+]/g, "\\$&")}([^\\w]|$)`, "i").test(text)) technologies.add(skill);
  }
  for (const [re, techs] of NEED_TECH) if (re.test(text)) techs.forEach((t) => technologies.add(t));

  const amounts: number[] = [];
  for (const m of text.matchAll(/(\d[\d\s.,]*\d|\d)\s*(millions?)?\s*(?:de\s+)?(?:F\s?CFA|FCFA|XOF|francs?\s+CFA)/gi)) {
    const v = parseAmount(m[1], m[2]);
    if (v && v >= 10_000) amounts.push(v);
  }

  let deadline: string | null = null;
  const numeric = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})/);
  const written = normalize(text).match(new RegExp(`(\\d{1,2})(?:er)?\\s+(${MONTHS.map(normalize).join("|")})\\s+(20\\d{2})`));
  if (numeric) deadline = `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  else if (written) deadline = `${written[3]}-${String(MONTHS.map(normalize).indexOf(written[2]) + 1).padStart(2, "0")}-${written[1].padStart(2, "0")}`;

  const city = Object.keys(CITIES).find((c) => new RegExp(`\\b${c}\\b`, "i").test(text)) ?? null;
  const country = COUNTRIES.find((c) => normalize(text).includes(normalize(c))) ?? (city ? CITIES[city] : null);
  const orgType: Extracted["org_type"] = /mairie|commune|minist[eè]re|collectivit|r[ée]gion|pr[ée]fecture|agence nationale/i.test(text)
    ? "collectivite"
    : /\bong\b|association|fondation|programme des nations|onu|unicef|croix-rouge/i.test(text)
      ? "ong"
      : /startup|start-up/i.test(text)
        ? "startup"
        : "pme";

  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s/);
  return {
    title: (lines[0] ?? "Besoin numérique").slice(0, 120),
    organization_name: null,
    org_type: orgType,
    need: sentences.slice(0, 2).join(" ").slice(0, 400),
    technologies: [...technologies].slice(0, 8),
    budget_min: amounts.length ? Math.min(...amounts) : null,
    budget_max: amounts.length ? Math.max(...amounts) : null,
    deadline,
    country,
    city,
  };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "organization_name", "org_type", "need", "technologies", "budget_min", "budget_max", "deadline", "country", "city"],
  properties: {
    title: { type: "string", description: "Titre court du besoin (moins de 100 caractères)" },
    organization_name: { type: ["string", "null"] },
    org_type: { type: "string", enum: ["pme", "ong", "collectivite", "startup", "entreprise"] },
    need: { type: "string", description: "Le besoin en une ou deux phrases simples" },
    technologies: { type: "array", items: { type: "string" }, description: "Technologies ou compétences utiles" },
    budget_min: { type: ["integer", "null"], description: "Budget minimum en FCFA" },
    budget_max: { type: ["integer", "null"], description: "Budget maximum en FCFA" },
    deadline: { type: ["string", "null"], description: "Date limite au format AAAA-MM-JJ" },
    country: { type: ["string", "null"] },
    city: { type: ["string", "null"] },
  },
};

async function extractByAI(raw: string, skills: string[]): Promise<Extracted | null> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: `Tu extrais les informations d'un appel d'offres ou d'un besoin numérique publié en Afrique.
N'invente rien : laisse à null ce qui n'est pas dans le texte. Les montants sont en FCFA (convertis « 5 millions » en 5000000).
Pour les technologies, privilégie ces libellés quand ils conviennent : ${skills.join(", ")}.`,
    messages: [{ role: "user", content: raw.slice(0, 8000) }],
  });
  if (response.stop_reason !== "end_turn") return null;
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(text) as Extracted;
  } catch {
    return null;
  }
}

export async function extractOpportunity(raw: string): Promise<{ data: Extracted; by: "ia" | "regles" }> {
  const skills = await knownSkills();
  if (hasAnthropicCredentials()) {
    try {
      const ai = await extractByAI(raw, skills);
      if (ai) {
        // Ramène les technologies sur les libellés du référentiel quand c'est possible
        ai.technologies = ai.technologies.map((t) => skills.find((s) => normalize(s) === normalize(t)) ?? t).slice(0, 8);
        return { data: ai, by: "ia" };
      }
    } catch (error) {
      console.error("Radar : extraction par IA impossible, repli sur les règles", error);
    }
  }
  return { data: extractByRules(raw, skills), by: "regles" };
}

// Correspondances + alertes (application, et WhatsApp pour ceux qui l'ont activé)
export async function matchAndAlert(opportunityId: string) {
  const admin = createAdminClient();
  const { data: count } = await admin.rpc("compute_opportunity_matches", { p_opportunity: opportunityId });
  const { data: alerted } = await admin.rpc("notify_opportunity_matches", { p_opportunity: opportunityId });
  const ids = ((alerted ?? []) as { user_id: string; score: number }[]).map((a) => a.user_id);

  if (ids.length) {
    const [{ data: o }, { data: phones }] = await Promise.all([
      admin.from("opportunities").select("title, organization_name").eq("id", opportunityId).single(),
      admin.from("profiles").select("whatsapp_number").in("id", ids).eq("whatsapp_alerts", true).not("whatsapp_number", "is", null),
    ]);
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/radar/${opportunityId}`;
    await Promise.all(
      (phones ?? []).map((p) => sendWhatsApp(p.whatsapp_number!, `🎯 *Radar Baobab Dev*\n${o?.organization_name} cherche : ${o?.title}\nTon profil correspond. ${url}`)),
    );
  }
  return { matches: (count as number) ?? 0, alerted: ids.length };
}

// Collecte : flux RSS ou Atom d'appels d'offres, filtrés sur le numérique, mis en file de validation
export async function collectSources() {
  const admin = createAdminClient();
  const { data: sources } = await admin.from("radar_sources").select("id, name, url, country").eq("active", true);
  let added = 0;
  for (const source of sources ?? []) {
    let xml = "";
    try {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      xml = await res.text();
    } catch {
      continue;
    }
    const items = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)].map((m) => m[0]).slice(0, 30);
    for (const item of items) {
      const tag = (name: string) =>
        item.match(new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`))?.[1]?.replace(/<[^>]+>/g, " ").trim() ?? "";
      const title = tag("title");
      const link = tag("link") || item.match(/<link[^>]*href="([^"]+)"/)?.[1] || "";
      const description = tag("description") || tag("summary") || tag("content");
      const raw = `${title}\n${description}`;
      if (!link || !DIGITAL.test(raw)) continue;

      const { data: exists } = await admin.from("opportunities").select("id").eq("source_url", link).maybeSingle();
      if (exists) continue;
      const { data: x, by } = await extractOpportunity(raw);
      const { data: inserted } = await admin
        .from("opportunities")
        .insert({
          source: "collectee",
          organization_name: x.organization_name ?? source.name,
          org_type: x.org_type,
          title: title.slice(0, 160) || x.title,
          raw_text: raw.slice(0, 8000),
          need: x.need,
          technologies: x.technologies,
          budget_min: x.budget_min,
          budget_max: x.budget_max,
          deadline: x.deadline,
          country: x.country ?? source.country,
          city: x.city,
          source_url: link,
          extracted_by: by,
          status: "pending", // visible du public après validation par l'administration
        })
        .select("id")
        .single();
      if (inserted) added++;
    }
    await admin.from("radar_sources").update({ last_fetched_at: new Date().toISOString() }).eq("id", source.id);
  }
  return { sources: sources?.length ?? 0, added };
}
