import Link from "next/link";
import { getSession } from "@/lib/auth";
import { GriotChat } from "./GriotChat";

export const metadata = { title: "Le Griot · Baobab Dev" };

export default async function GriotPage() {
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
    console.error("Griot : migration de discussions non appliquée, chargement de l’historique sans lien de discussion");
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
  if (historyError) console.error("Griot : impossible de charger l’historique privé", historyError);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Le Griot</h1>
      <p className="mt-1 text-muted">
        Un assistant spécialisé en développement qui s&apos;appuie sur les réponses de la communauté, cite leurs auteurs
        et leur fait gagner des XP. Sans source communautaire, le Griot peut répondre; cette réponse peut être soumise à un expert.
      </p>
      <a
        href={whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Griot, ")}` : "/griot/whatsapp"}
        className="mt-3 inline-block text-sm text-leaf hover:underline"
      >
        Aussi disponible sur WhatsApp →
      </a>
      {user ? (
        <GriotChat
          history={(history ?? []).slice(0, 30)}
          historyHasMore={(history?.length ?? 0) > 30}
          historyUnavailable={Boolean(historyError)}
        />
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
