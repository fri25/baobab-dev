import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { GriotChat } from "./GriotChat";

export async function generateMetadata() {
  return { title: await pageTitle("Le Griot · Baobab Dev") };
}

export default async function GriotPage() {
  const t = await getT();
  const { supabase, user } = await getSession();
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const initialHistoryResult = user
    ? await supabase
        .from("griot_queries")
        .select("id, question, answer, created_at, escalated_conversation_id, escalated_question_id")
        .eq("user_id", user.id)
        .not("answer", "is", null)
        .order("created_at", { ascending: false })
        .limit(31)
    : { data: [], error: null };
  let history = initialHistoryResult.data;
  let historyError = initialHistoryResult.error;
  if (user && historyError?.message.includes("escalated_conversation_id")) {
    console.error("Griot : migration de discussions non appliquée, chargement de l'historique sans lien de discussion");
    const fallbackHistory = await supabase
      .from("griot_queries")
      .select("id, question, answer, created_at, escalated_question_id")
      .eq("user_id", user.id)
      .not("answer", "is", null)
      .order("created_at", { ascending: false })
      .limit(31);
    history = fallbackHistory.data?.map((item) => ({ ...item, escalated_conversation_id: null })) ?? null;
    historyError = fallbackHistory.error;
  }
  if (historyError) console.error("Griot : impossible de charger l'historique privé", historyError);

  return (
    <main data-page="griot" className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      {/* ── Hero immersif ── */}
      <section className="griot-hero relative overflow-hidden border-b border-border/60">
        {/* Orbes décoratives */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/95" />
        </div>

        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 pb-8 pt-10 text-center sm:pb-10 sm:pt-14">
          {/* Avatar Griot avec glow */}
          <div className="group relative">
            <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-primary/40 ring-offset-4 ring-offset-background transition duration-500 group-hover:ring-primary/70 sm:h-24 sm:w-24">
              <Image
                src="/griot-avatar.jpg"
                alt={t("Avatar du Griot")}
                fill
                sizes="(max-width: 640px) 80px, 96px"
                className="object-cover object-[50%_42%]"
                priority
              />
            </div>
            {/* Badge En direct */}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-leaf/40 bg-leaf/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-leaf backdrop-blur-sm sm:text-xs">
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-leaf" />
              {t("En direct")}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Le Griot")}</h1>
            <p className="text-base font-medium text-muted sm:text-lg">
              {t("La parole des sages, l'expertise en plus.")}
            </p>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-muted/80">
            {t("Comme un véritable griot moderne, notre assistant fait résonner la voix de la communauté, cite ses auteurs et distribue des XP. En quête de vérité absolue ? Le Griot consulte ses sources ou en appelle à l'œil d'un expert.")}
          </p>

          {/* Badges de fonctionnalités */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 font-medium text-primary">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378c.635 1.19-.167 2.575-1.543 2.575H1.918c-1.376 0-2.178-1.385-1.543-2.575L6.457 1.047zm1.037.965L1.412 13.39c-.211.395.056.61.506.61h12.164c.45 0 .717-.215.506-.61L8.506 2.012a.29.29 0 0 0-.506 0h-.506z"/></svg>
              {t("Sources citées")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf/25 bg-leaf/8 px-3 py-1 font-medium text-leaf">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-9 8c0-2.5 2.5-4 5-4s5 1.5 5 4v.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V14z"/></svg>
              {t("+5 XP par citation")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/25 bg-violet/8 px-3 py-1 font-medium text-violet">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zm-1-5h2v3H7v-3zm0-1V5h2v3H7z"/></svg>
              {t("Escalade experts")}
            </span>
          </div>

          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Griot, ")}`}
              className="inline-flex items-center gap-2 rounded-full border border-leaf/30 bg-leaf/10 px-4 py-2 text-sm font-medium text-leaf transition hover:bg-leaf/20"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.555 4.124 1.527 5.856L.057 23.76l6.084-1.453A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 0 1-5.39-1.578l-.387-.228-3.612.863.907-3.51-.256-.4A9.935 9.935 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              {t("Aussi sur WhatsApp")}
            </a>
          )}
          {!whatsapp && (
            <Link
              href="/griot/whatsapp"
              className="inline-flex items-center gap-2 rounded-full border border-leaf/30 bg-leaf/10 px-4 py-2 text-sm font-medium text-leaf transition hover:bg-leaf/20"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.555 4.124 1.527 5.856L.057 23.76l6.084-1.453A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 0 1-5.39-1.578l-.387-.228-3.612.863.907-3.51-.256-.4A9.935 9.935 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              {t("Aussi sur WhatsApp")}
            </Link>
          )}
        </div>
      </section>

      {/* ── Chat ou Connexion ── */}
      {user ? (
        <GriotChat
          history={(history ?? []).slice(0, 30)}
          historyHasMore={(history?.length ?? 0) > 30}
          historyUnavailable={Boolean(historyError)}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface/70 p-6 text-center shadow-lg backdrop-blur-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">{t("Accède au Griot")}</h2>
              <p className="mt-1 text-sm text-muted">{t("20 questions gratuites par jour")}</p>
            </div>
            <Link
              href="/login?next=/griot"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-ink transition hover:opacity-90"
            >
              {t("Se connecter")}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
