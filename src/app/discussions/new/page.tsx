import { getT, pageTitle } from "@/lib/i18n/server";
import { requireSession } from "@/lib/auth";
import type { Relation } from "../RelationsPicker";
import { TopicForm } from "./TopicForm";

export async function generateMetadata() {
  return { title: await pageTitle("Lancer un sujet · Baobab Dev") };
}

export default async function NewTopicPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  const { supabase } = await requireSession("/discussions/new");
  const { error } = await searchParams;
  const { data: relations } = await supabase.rpc("my_relations");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Lancer un sujet")}</h1>
      <p className="mt-1 text-muted">{t("Un salon de discussion ouvert à toute la communauté, tout de suite ou à une heure fixée.")}</p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <TopicForm relations={(relations ?? []) as Relation[]} />
    </main>
  );
}
