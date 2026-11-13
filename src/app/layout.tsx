import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ServiceWorker } from "@/components/ServiceWorker";
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

export const metadata: Metadata = {
  title: "Baobab Dev",
  description: "La plateforme d'échange africaine, pour les devs, par les devs.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Baobab Dev" },
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
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
  const theme = isThemePreference(themeCookie) ? themeCookie : "system";

  return (
    <html
      lang="fr"
      data-lite={lite ? "" : undefined}
      data-theme={theme === "system" ? undefined : theme}
    >
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ServiceWorker />
        <Header themePreference={theme} />
        {children}
        <footer className="mt-auto border-t border-border py-6 text-sm text-muted">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4">
            <span>Baobab Dev · Coupe d&apos;Afrique des développeurs 2026</span>
            <nav className="flex flex-wrap gap-4">
              <Link href="/classements" className="hover:text-foreground">
                Classements
              </Link>
              <Link href="/defis" className="hover:text-foreground">
                Défis
              </Link>
              <Link href="/stack" className="hover:text-foreground">
                Stack Afrique
              </Link>
              <Link href="/activite" className="hover:text-foreground">
                GitHub vivant
              </Link>
              <Link href="/debug" className="hover:text-foreground">
                Pair-Debugging
              </Link>
              <Link href="/recruteurs" className="hover:text-foreground">
                Espace recruteurs
              </Link>
              <Link href="/propositions" className="hover:text-foreground">
                Mes propositions
              </Link>
              <form action={toggleLite}>
                <button className="hover:text-foreground">{lite ? "Désactiver" : "Activer"} le mode données réduites</button>
              </form>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
