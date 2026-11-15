import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Logo } from "@/components/Logo";
import { ServiceWorker } from "@/components/ServiceWorker";
import { LocaleProvider } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
import { isThemePreference } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Baobab Dev · La plateforme d'échange des développeurs africains"),
    description: t("La plateforme d'échange africaine, pour les devs, par les devs. S'entraider, construire ensemble, être reconnu et gagner sa vie."),
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
    appleWebApp: { capable: true, title: "Baobab Dev" },
  };
}

const FOOTER = [
  {
    title: "Échanger",
    color: "text-primary",
    links: [
      ["/questions", "Questions & Réponses"],
      ["/discussions", "Discussions en direct"],
      ["/griot", "Le Griot (IA communautaire)"],
      ["/classements", "Classements panafricains"],
      ["/fil", "Mon fil personnalisé"],
    ],
  },
  {
    title: "Construire",
    color: "text-leaf",
    links: [
      ["/showroom", "Showroom des projets"],
      ["/squads", "Squads par compétences"],
      ["/defis", "Défis de la semaine"],
      ["/debug", "Pair-Debugging 3G"],
      ["/stack", "Stack Afrique vérifiée"],
      ["/activite", "GitHub vivant"],
    ],
  },
  {
    title: "Gagner",
    color: "text-gold",
    links: [
      ["/bourse", "Micro-Bourse de code"],
      ["/radar", "Radar d'opportunités"],
      ["/forensic", "Code Forensic (Audits)"],
      ["/centrale", "Centrale d'achat cloud"],
      ["/clones", "Clones IA de seniors"],
      ["/recruteurs", "Espace recruteurs"],
    ],
  },
];

// Actions serveur lentes (Griot, clones IA, correcteur des défis, extraction du Radar) : 60 s sur Vercel
export const maxDuration = 60;

export const viewport: Viewport = {
  themeColor: "#0b1526",
};

async function toggleLite() {
  "use server";
  const store = await cookies();
  if (store.get("lite")) store.delete("lite");
  else store.set("lite", "1", { maxAge: 60 * 60 * 24 * 365, path: "/" });
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const lite = Boolean(cookieStore.get("lite"));
  const themeCookie = cookieStore.get("theme")?.value;
  const theme = isThemePreference(themeCookie) ? themeCookie : "dark";
  const locale = await getLocale();
  const t = await getT();

  return (
    <html
      lang={locale}
      className="overflow-x-hidden"
      data-lite={lite ? "" : undefined}
      data-theme={theme === "system" ? undefined : theme}
    >
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen flex flex-col overflow-x-hidden`}>
        <LocaleProvider locale={locale}>
        <ServiceWorker />
        <Header />
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
        {/* Contenu principal */}
        {children}

        {/* Pied de page moderne et aéré */}
        <footer className="mt-20 border-t border-border/80 bg-surface/40 backdrop-blur-md overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
              {/* Colonne marque */}
              <div className="space-y-4 lg:col-span-2">
                <Link href="/" className="inline-flex items-center gap-2.5 font-bold tracking-tight">
                  <Logo className="h-9 w-9" />
                  <span className="text-lg font-extrabold uppercase tracking-wide">
                    Baobab <span className="text-brand">Dev</span>
                  </span>
                </Link>
                <p className="max-w-sm text-sm leading-relaxed text-muted">
                  {t("La plateforme d'échange africaine, pour les devs, par les devs. Conçue pour les conditions réelles du continent : réseau 3G, PWA, entraide et récompenses en Mobile Money.")}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf/30 bg-leaf/10 px-3 py-1 text-xs font-medium text-leaf">
                    <span className="h-1.5 w-1.5 rounded-full bg-leaf animate-pulse" />
                    {t("Coupe d'Afrique des développeurs 2026")}
                  </span>
                  <form action={toggleLite}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/70 px-3 py-1 text-xs font-medium text-muted transition hover:border-primary/50 hover:text-foreground"
                    >
                      <span className="text-primary">{lite ? "✓" : "⚡"}</span>
                      {lite ? t("Mode données réduites actif") : t("Activer données réduites")}
                    </button>
                  </form>
                </div>
              </div>

              {FOOTER.map((col) => (
                <div key={col.title}>
                  <p className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{t(col.title)}</p>
                  <ul className="mt-4 space-y-2 text-sm text-muted">
                    {col.links.map(([href, label]) => (
                      <li key={href}>
                        <Link href={href} className="transition hover:text-foreground">
                          {t(label)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Barre inférieure */}
            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted sm:flex-row">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                <span>{t("Tous les systèmes sont opérationnels · PWA installable")}</span>
              </div>
              <p>
                {t("© 2026 Baobab Dev. Fait avec passion pour l'écosystème tech africain.")}
              </p>
            </div>
          </div>
        </footer>
          </div>
        </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
