// Traduction façon gettext : la phrase française sert de clé, le dictionnaire anglais la traduit.
// Une phrase absente du dictionnaire reste en français : la traduction peut avancer page par page.
// Variables : t("Il reste {n} jours", { n: 3 }).
import { en } from "./en";

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "lang";

export const isLocale = (v: unknown): v is Locale => v === "fr" || v === "en";

export type Vars = Record<string, string | number>;
export type T = (text: string, vars?: Vars) => string;

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text);

export function translator(locale: Locale): T {
  if (locale === "fr") return fill;
  // Espaces insécables (typographie française avant « ? : ») ignorés pour la recherche
  return (text, vars) => fill(en[text] ?? en[text.replace(/[  ]/g, " ")] ?? text, vars);
}

/** Traduit les valeurs d'un dictionnaire de libellés (ex. CHALLENGE_KIND). */
export function translateLabels<K extends string>(labels: Record<K, string>, t: T): Record<K, string> {
  return Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, t(v as string)])) as Record<K, string>;
}

export const DATE_LOCALE: Record<Locale, string> = { fr: "fr-FR", en: "en-GB" };
