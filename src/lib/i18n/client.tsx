"use client";

import { createContext, useContext, useMemo } from "react";
import { rememberLocale } from "./current";
import { translator, type Locale } from "./shared";

const LocaleContext = createContext<Locale>("fr");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  rememberLocale(locale);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

export function useT() {
  const locale = useLocale();
  return useMemo(() => translator(locale), [locale]);
}
