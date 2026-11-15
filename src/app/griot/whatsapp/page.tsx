import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { WhatsAppDemo } from "./WhatsAppDemo";

export async function generateMetadata() {
  return { title: await pageTitle("Le Griot sur WhatsApp · Baobab Dev") };
}

export default async function WhatsAppPage() {
  const t = await getT();
  await requireSession("/griot/whatsapp");
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Fil d'Ariane & Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/griot"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"
            />
          </svg>
          {t("Retour au Griot")}
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf/30 bg-leaf/10 px-3 py-1 text-xs font-semibold text-leaf">
          <span className="h-1.5 w-1.5 rounded-full bg-leaf animate-pulse" />
          {t("Bot WhatsApp Business")}
        </span>
      </div>

      {/* Titre & Explication */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Le Griot sur WhatsApp")}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
          {t("Démonstration interactive du webhook WhatsApp Business. Pose une question de code dans le simulateur ci-dessous : le Griot puise dans les réponses de la communauté et rétribue les auteurs en XP en direct.")}
        </p>

        {whatsapp && (
          <div className="mt-4 flex justify-center">
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Griot, ")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#25D366]/25 transition hover:brightness-105"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.555 4.124 1.527 5.856L.057 23.76l6.084-1.453A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 0 1-5.39-1.578l-.387-.228-3.612.863.907-3.51-.256-.4A9.935 9.935 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              {t("Discuter sur le vrai WhatsApp (+")}{whatsapp})
            </a>
          </div>
        )}
      </div>

      {/* Grille : Simulateur téléphone à gauche / Explications à droite sur écran large */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)] lg:gap-12">
        <div className="flex justify-center">
          <WhatsAppDemo />
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-5 shadow-xs backdrop-blur-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">1</span>
              {t("Pourquoi WhatsApp ?")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t("En Afrique de l'Ouest et centrale, la plupart des forfaits mobiles incluent WhatsApp illimité même lorsque les mégas web sont épuisés. Le Griot sur WhatsApp permet à un développeur de débloquer son bug directement sans data web supplémentaire.")}
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-surface/70 p-5 shadow-xs backdrop-blur-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-leaf/10 text-leaf text-sm font-bold">2</span>
              {t("Attribution & Rétribution en direct")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t("Chaque réponse cite les développeurs dont les contributions ont nourri le modèle. Chaque citation octroie instantanément")}{" "}<strong className="text-leaf">{t("+5 XP")}</strong>{" "}{t("au membre cité sur Baobab Dev.")}
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-surface/70 p-5 shadow-xs backdrop-blur-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/10 text-violet text-sm font-bold">3</span>
              {t("Escalade intelligente")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t("Si la question nécessite un regard humain, le Griot invite à transférer la question sur la plateforme où les experts de niveau 5 et plus sont alertés.")}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
