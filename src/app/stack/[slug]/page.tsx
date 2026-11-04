import Link from "next/link";
import { notFound } from "next/navigation";
import { UserChip } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { getSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { STACK_CATEGORY, STACK_STATUS } from "@/lib/labels";
import { attest, setStackStatus, withdrawAttestation } from "../actions";

type Person = { username: string; full_name: string | null; avatar_url: string | null; city: string | null };

export default async function StackItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await getSession();

  const { data: item } = await supabase.from("stack_items").select("*").eq("slug", slug).maybeSingle();
  if (!item) notFound();
  const { data: attestations } = await supabase
    .from("stack_attestations")
    .select("user_id, comment, created_at, dev:profiles!stack_attestations_user_id_fkey(username, full_name, avatar_url, city)")
    .eq("item_id", item.id)
    .order("created_at");

  const status = STACK_STATUS[item.status];
  const mine = attestations?.some((a) => a.user_id === user?.id);
  const isModerator = profile && ["moderator", "admin"].includes(profile.role);
  const count = attestations?.length ?? 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/stack" className="text-sm text-muted hover:text-primary">
        ← Stack Afrique
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{item.name}</h1>
        <span className={`rounded-full px-3 py-1 text-sm ${status.className}`}>{status.label}</span>
      </div>
      <p className="text-sm text-muted">{STACK_CATEGORY[item.category]}</p>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <p className="mt-6 text-lg">{item.description}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        {item.website && (
          <a href={item.website} className="text-primary">
            Site officiel
          </a>
        )}
        {item.docs_url && (
          <a href={item.docs_url} className="text-primary">
            Documentation
          </a>
        )}
        {item.health_status && (
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${item.health_status === "up" ? "bg-leaf" : "bg-primary"}`} />
            API {item.health_status === "up" ? "en ligne" : "en panne"} · vérifiée {timeAgo(item.health_checked_at)}
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {item.compatible_versions && (
            <section>
              <h2 className="font-semibold">Versions compatibles</h2>
              <p className="mt-1 text-sm">{item.compatible_versions}</p>
            </section>
          )}
          {item.code_example && (
            <section>
              <h2 className="mb-2 font-semibold">Exemple</h2>
              <Markdown text={item.code_example} />
            </section>
          )}
          {item.pitfalls && (
            <section className="rounded-xl border border-gold/50 bg-gold/5 p-4">
              <h2 className="mb-2 font-semibold">Pièges connus</h2>
              <Markdown text={item.pitfalls} />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section>
            <h2 className="font-semibold">En production chez {count} dev(s)</h2>
            <div className="mt-2 h-2 rounded-full bg-border">
              <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.min(100, (count / 5) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">
              {count >= 5 ? "Seuil de vérification atteint." : `Encore ${5 - count} attestation(s) avant vérification.`}
            </p>
            <ul className="mt-3 space-y-3">
              {attestations?.map((a) => (
                <li key={a.user_id} className="text-sm">
                  <UserChip user={a.dev as unknown as Person} />
                  {a.comment && <p className="mt-1 text-muted">« {a.comment} »</p>}
                </li>
              ))}
            </ul>
          </section>

          {user &&
            (mine ? (
              <form action={withdrawAttestation.bind(null, item.id, slug)}>
                <button className="text-xs text-muted hover:text-primary">Retirer mon attestation</button>
              </form>
            ) : (
              <form action={attest.bind(null, item.id, slug)} className="space-y-2 rounded-xl border border-dashed border-border p-3">
                <input name="comment" placeholder="Ton retour (facultatif)" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
                <button className="w-full rounded-full bg-leaf px-4 py-2 text-sm font-medium text-background">
                  Je l&apos;utilise en production
                </button>
              </form>
            ))}

          {isModerator && (
            <section className="rounded-xl border border-border bg-surface p-3 text-sm">
              <h2 className="font-semibold">Modération</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.status !== "verifie" && (
                  <form action={setStackStatus.bind(null, item.id, slug, "verifie")}>
                    <button className="rounded-full bg-leaf px-3 py-1 text-xs text-background">Valider</button>
                  </form>
                )}
                {item.status !== "deconseille" && (
                  <form action={setStackStatus.bind(null, item.id, slug, "deconseille")}>
                    <button className="rounded-full border border-primary px-3 py-1 text-xs text-primary">Déconseiller</button>
                  </form>
                )}
                {item.status !== "test" && (
                  <form action={setStackStatus.bind(null, item.id, slug, "test")}>
                    <button className="rounded-full border border-border px-3 py-1 text-xs">Remettre en test</button>
                  </form>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
