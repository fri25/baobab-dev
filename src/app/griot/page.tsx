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
    <main data-page="griot" className="mx-auto max-w-5xl px-4 pb-2 pt-4">
      <section className="sticky top-28 z-10 rounded-2xl border border-primary/25 bg-background/95 p-3 shadow-sm backdrop-blur sm:p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Le Griot</h1>
          <h2 className="text-base font-semibold text-foreground sm:text-lg">La parole des sages, l’expertise en plus.</h2>
        </div>
        <p className="mt-1 line-clamp-2 max-w-4xl text-sm leading-relaxed text-muted">
          Comme un véritable griot moderne, notre assistant fait résonner la voix de la communauté, cite ses auteurs et distribue des XP. En quête de vérité absolue ? Le Griot consulte ses sources ou en appelle à l’œil d’un expert.
        </p>
        <a
          href={whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Griot, ")}` : "/griot/whatsapp"}
          className="mt-1 inline-block text-sm font-medium text-leaf hover:underline"
        >
          Aussi disponible sur WhatsApp →
        </a>
      </section>
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
