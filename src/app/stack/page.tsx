import Link from "next/link";
import { STACK_CATEGORY, STACK_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Stack Afrique · Baobab Dev" };

export default async function StackPage({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const { categorie } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("stack_items")
    .select("id, name, slug, category, description, status, health_status, stack_attestations(count)")
    .order("status", { ascending: false })
    .order("name");
  if (categorie) query = query.eq("category", categorie);
  const { data: items } = await query;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Stack Afrique vérifiée</h1>
          <p className="max-w-2xl text-muted">
            Bibliothèques, SDK et API du contexte africain, certifiés par des devs qui les utilisent en production. Un outil
            devient « vérifié » avec au moins 5 attestations et la validation d&apos;un modérateur.
          </p>
        </div>
        <Link href="/stack/new" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
          Proposer un outil
        </Link>
      </div>

      <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 text-sm">
        <Link href="/stack" className={`shrink-0 rounded-full px-3 py-1 ${!categorie ? "bg-foreground text-background" : "border border-border"}`}>
          Tout
        </Link>
        {Object.entries(STACK_CATEGORY).map(([key, label]) => (
          <Link
            key={key}
            href={`/stack?categorie=${key}`}
            className={`shrink-0 rounded-full px-3 py-1 ${categorie === key ? "bg-foreground text-background" : "border border-border"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((item) => {
          const status = STACK_STATUS[item.status];
          const attestations = (item.stack_attestations as unknown as { count: number }[])[0]?.count ?? 0;
          return (
            <li key={item.id}>
              <Link href={`/stack/${item.slug}`} className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 hover:border-primary">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-lg font-semibold">{item.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
                </div>
                <span className="text-xs text-muted">{STACK_CATEGORY[item.category]}</span>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{item.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>{attestations} dev(s) en production</span>
                  {item.health_status && (
                    <span className="flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${item.health_status === "up" ? "bg-leaf" : "bg-primary"}`} />
                      API {item.health_status === "up" ? "en ligne" : "en panne"}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
