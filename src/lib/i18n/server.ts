import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { rememberLocale } from "./current";
import { isLocale, LOCALE_COOKIE, translator, type Locale } from "./shared";

/** Langue choisie (cookie), sinon celle du navigateur ; français par défaut. */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  const locale: Locale = isLocale(chosen) ? chosen : first.startsWith("en") ? "en" : "fr";
  rememberLocale(locale);
  return locale;
});

export async function getT() {
  return translator(await getLocale());
}

/** Titre d'onglet traduit segment par segment : "Défis · Baobab Dev" → "Challenges · Baobab Dev" */
export async function pageTitle(title: string) {
  const t = await getT();
  return title
    .split(" · ")
    .map((part) => t(part))
    .join(" · ");
}
