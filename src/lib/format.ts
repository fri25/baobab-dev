import { currentLocale, dateLocale } from "@/lib/i18n/current";

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
const rtfFor = (locale: string) => {
  if (!rtfCache.has(locale)) rtfCache.set(locale, new Intl.RelativeTimeFormat(locale, { numeric: "auto" }));
  return rtfCache.get(locale)!;
};

export function timeAgo(date: string | Date) {
  const locale = currentLocale();
  const rtf = rtfFor(locale);
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return locale === "en" ? "just now" : "à l'instant";
}

export function fcfa(amount: number) {
  return `${amount.toLocaleString(dateLocale())} FCFA`;
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function parseTags(raw: FormDataEntryValue | null) {
  return String(raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);
}

// Extrait lisible d'un texte Markdown (cartes, aperçus) : sans les symboles de mise en forme
export function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, "")
    .replace(/(\*\*|\*|_|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
