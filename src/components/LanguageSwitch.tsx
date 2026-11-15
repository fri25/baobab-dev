import { setLocale } from "@/lib/i18n/actions";
import { getLocale } from "@/lib/i18n/server";

// Bascule FR / EN : mémorisée dans un cookie, la page se recharge dans l'autre langue.
export async function LanguageSwitch() {
  const locale = await getLocale();
  const next = locale === "fr" ? "en" : "fr";
  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={next} />
      <button
        type="submit"
        lang={next}
        aria-label={next === "en" ? "Switch to English" : "Passer en français"}
        title={next === "en" ? "Switch to English" : "Passer en français"}
        className="inline-flex h-8 items-center rounded-full border border-border/80 bg-surface/70 px-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted transition hover:border-primary/50 hover:text-foreground"
      >
        {next}
      </button>
    </form>
  );
}
