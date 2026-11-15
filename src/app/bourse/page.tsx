import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { UserChip } from "@/components/Avatar";
import { fcfa, timeAgo } from "@/lib/format";
import { BOUNTY_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  return { title: await pageTitle("Micro-Bourse de code · Baobab Dev") };
}

export default async function BoursePage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const t = await getT();
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
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gold/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-gold uppercase">
              {t("Rémunération garantie")}
            </span>
            <span className="text-xs text-muted">{t("Séquestre sécurisé")}</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl tracking-tight">{t("Micro-Bourse de code")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {t("Bugs et fonctionnalités financés par la communauté. La prime est bloquée en séquestre et versée directement en Mobile Money à la validation des tests.")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/portefeuille"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/70 px-4 py-2 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-surface"
          >
            <span>{t("Mon portefeuille")}</span>
            <span className="text-primary font-mono font-bold">₣</span>
          </Link>
          <Link
            href="/bourse/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-ink shadow-md shadow-primary/20 transition hover:opacity-95 hover:shadow-lg sm:text-sm"
          >
            <span>{t("+ Créer un ticket")}</span>
          </Link>
        </div>
      </div>

      {/* Filtres d'état */}
      <nav className="mt-6 flex gap-2 text-xs sm:text-sm">
        <Link
          href="/bourse"
          className={`rounded-full px-4 py-1.5 font-semibold transition ${
            statut !== "payes"
              ? "bg-primary text-primary-ink shadow-xs"
              : "border border-border/80 bg-surface/70 text-muted hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {t("Tickets ouverts")}
        </Link>
        <Link
          href="/bourse?statut=payes"
          className={`rounded-full px-4 py-1.5 font-semibold transition ${
            statut === "payes"
              ? "bg-primary text-primary-ink shadow-xs"
              : "border border-border/80 bg-surface/70 text-muted hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {t("Primes versées (historique)")}
        </Link>
      </nav>

      {/* Liste des tickets */}
      <ul className="mt-6 space-y-4">
        {bounties?.length ? (
          bounties.map((b) => {
            const status = BOUNTY_STATUS[b.status];
            const contributors = (b.bounty_contributions as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <li key={b.id}>
                <div className="group flex flex-col justify-between gap-4 rounded-3xl border border-border/80 bg-surface/85 p-5 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-lg hover:shadow-gold/5 sm:flex-row sm:items-center sm:p-6">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/bourse/${b.id}`}
                      className="text-base font-bold text-foreground transition hover:text-primary sm:text-lg block"
                    >
                      {b.title}
                    </Link>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
                        {status.label}
                      </span>
                      <span>·</span>
                      <span>
                        {contributors}{" "}{t("contributeur")}{contributors > 1 ? "s" : ""}
                      </span>
                      <span>·</span>
                      <span>{t("Échéance")}{" "}{timeAgo(b.deadline)}</span>
                      {b.creator && (
                        <>
                          <span>·</span>
                          <UserChip user={b.creator as never} />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-3 sm:border-0 sm:pt-0">
                    <span className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-lg font-extrabold text-gold shadow-xs sm:text-xl">
                      {fcfa(b.total_amount)}
                    </span>
                    <Link
                      href={`/bourse/${b.id}`}
                      className="rounded-full bg-primary/10 border border-primary/25 px-4 py-1.5 font-mono text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-ink"
                    >
                      {t("Détails →")}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })
        ) : (
          <li className="rounded-3xl border border-dashed border-border bg-surface/50 p-12 text-center text-sm text-muted">
            {t("Aucun ticket dans cette catégorie pour le moment.")}
          </li>
        )}
      </ul>
    </main>
  );
}
