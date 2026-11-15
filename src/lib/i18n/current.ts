// Langue courante, lisible de façon synchrone (dates relatives, montants, dates).
// Côté serveur (composants serveur) : mémorisée par requête avec React.cache, renseignée par getLocale().
// Côté client : renseignée par <LocaleProvider>.
import { cache } from "react";
import { DATE_LOCALE, translator, type Locale, type Vars } from "./shared";

const requestStore = cache((): { locale: Locale | null } => ({ locale: null }));
let moduleLocale: Locale = "fr";

export function rememberLocale(locale: Locale) {
  try {
    requestStore().locale = locale;
  } catch {
    // hors rendu React
  }
  moduleLocale = locale;
}

export function currentLocale(): Locale {
  if (typeof window === "undefined") {
    try {
      const l = requestStore().locale;
      if (l) return l;
    } catch {
      // hors rendu React
    }
  }
  return moduleLocale;
}

/** Locale Intl pour toLocaleDateString / toLocaleString */
export const dateLocale = () => DATE_LOCALE[currentLocale()];

/** Traducteur de la langue courante, pour le code hors composant (libellés, messages). */
export const tc = (text: string, vars?: Vars) => translator(currentLocale())(text, vars);

/**
 * Table de libellés traduite à la lecture : chaque chaîne lue passe par le dictionnaire
 * de la langue courante (les classes CSS, couleurs ou liens, absents du dictionnaire, restent tels quels).
 */
export function localized<T extends object>(table: T): T {
  return new Proxy(table, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "string") return tc(value);
      if (value && typeof value === "object") return localized(value);
      return value;
    },
  });
}
