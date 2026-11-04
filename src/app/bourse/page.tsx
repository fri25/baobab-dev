import Link from "next/link";
import { UserChip } from "@/components/Avatar";
import { fcfa, timeAgo } from "@/lib/format";
import { BOUNTY_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Micro-Bourse de code · Baobab Dev" };

export default async function BoursePage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("bounties")
    .select("id, title, total_amount, status, deadline, created_at, bounty_contributions(count), creator:profiles!bounties_creator_id_fkey(username, full_name, avatar_url, city)")
    .order("created_at", { ascending: false })
    .limit(40);
  query = statut === "payes" ? query.eq("status", "paid") : query.in("status", ["open", "reserved", "in_review", "disputed"]);
  const { data: bounties } = await query;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Micro-Bourse de code</h1>
          <p className="max-w-2xl text-muted">
            Des bugs et fonctionnalités financés par la communauté. La prime est bloquée en séquestre et versée au code qui
            passe les tests, en Mobile Money.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/portefeuille" className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">
            Mon portefeuille
          </Link>
          <Link href="/bourse/new" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
            Créer un ticket
          </Link>
        </div>
      </div>

      <nav className="mt-6 flex gap-2 text-sm">
        <Link href="/bourse" className={`rounded-full px-3 py-1 ${statut !== "payes" ? "bg-foreground text-background" : "border border-border"}`}>
          Ouverts
        </Link>
        <Link href="/bourse?statut=payes" className={`rounded-full px-3 py-1 ${statut === "payes" ? "bg-foreground text-background" : "border border-border"}`}>
          Primes versées
        </Link>
      </nav>

      <ul className="mt-6 space-y-3">
        {bounties?.length ? (
          bounties.map((b) => {
            const status = BOUNTY_STATUS[b.status];
            const contributors = (b.bounty_contributions as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <li key={b.id}>
                <Link
                  href={`/bourse/${b.id}`}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4 hover:border-gold"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{b.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
                        {status.label}
                      </span>
                      <span>{contributors} contributeur{contributors > 1 ? "s" : ""}</span>
                      <span>échéance {timeAgo(b.deadline)}</span>
                      {b.creator && <UserChip user={b.creator as never} />}
                    </div>
                  </div>
                  <span className="font-mono text-xl font-bold text-gold">{fcfa(b.total_amount)}</span>
                </Link>
              </li>
            );
          })
        ) : (
          <li className="rounded-xl border border-border bg-surface p-6 text-center text-muted">Aucun ticket pour l&apos;instant.</li>
        )}
      </ul>
    </main>
  );
}
