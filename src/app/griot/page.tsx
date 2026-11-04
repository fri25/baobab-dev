import Link from "next/link";
import { getSession } from "@/lib/auth";
import { GriotChat } from "./GriotChat";

export const metadata = { title: "Le Griot · Baobab Dev" };

export default async function GriotPage() {
  const { user } = await getSession();
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Le Griot</h1>
      <p className="mt-1 text-muted">
        L&apos;IA communautaire qui répond uniquement à partir des réponses validées de la communauté, cite leurs
        auteurs et leur fait gagner des XP. Sans source fiable, elle n&apos;invente rien.
      </p>
      <a
        href={whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Griot, ")}` : "/griot/whatsapp"}
        className="mt-3 inline-block text-sm text-leaf hover:underline"
      >
        Aussi disponible sur WhatsApp →
      </a>
      {user ? (
        <GriotChat />
      ) : (
        <p className="mt-8 rounded-xl border border-border bg-surface p-4 text-center text-sm">
          <Link href="/login?next=/griot" className="text-primary">
            Connecte-toi
          </Link>{" "}
          pour interroger le Griot (20 questions gratuites par jour).
        </p>
      )}
    </main>
  );
}
