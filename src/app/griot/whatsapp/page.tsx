import { requireSession } from "@/lib/auth";
import { WhatsAppDemo } from "./WhatsAppDemo";

export const metadata = { title: "Le Griot sur WhatsApp · Baobab Dev" };

export default async function WhatsAppPage() {
  await requireSession("/griot/whatsapp");
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-center text-2xl font-bold">Le Griot sur WhatsApp</h1>
      <p className="mb-6 mt-1 text-center text-sm text-muted">
        Démonstration : même moteur que le webhook WhatsApp Business. Les auteurs cités gagnent leurs XP en direct.
      </p>
      <WhatsAppDemo />
    </main>
  );
}
