import { dateLocale } from "@/lib/i18n/current";
import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { testTopup } from "../bourse/actions";

export async function generateMetadata() {
  return { title: await pageTitle("Portefeuille · Baobab Dev") };
}

const KIND: Record<string, string> = {
  topup: "Recharge",
  withdrawal: "Retrait",
  escrow_hold: "Prime bloquée en séquestre",
  escrow_release: "Prime reçue",
  escrow_refund: "Remboursement",
  commission: "Commission",
  clone_payment: "Question à un clone IA",
  clone_earning: "Revenu de ton clone IA",
  clone_refund: "Remboursement (clone IA)",
  clone_pass: "Pass Clones",
  clone_pass_payout: "Part des Pass Clones",
  audit_payment: "Forfait Code Forensic bloqué",
  audit_payout: "Paiement d'un audit",
  audit_refund: "Forfait d'audit remboursé",
  infra_usage: "Centrale d'achat (consommation)",
  recruiter_subscription: "Abonnement recruteurs (30 jours)",
};

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const tr = await getT();
  const { supabase, user } = await requireSession("/portefeuille");
  const { error } = await searchParams;

  const [{ data: wallet }, { data: transactions }, { data: mode }] = await Promise.all([
    supabase.from("wallets").select("balance").eq("user_id", user.id).single(),
    supabase
      .from("transactions")
      .select("id, amount, kind, ref_type, ref_id, is_test, hash, created_at")
      .eq("user_id", user.id)
      .order("id", { ascending: false })
      .limit(50),
    supabase.from("app_settings").select("value").eq("key", "payments_mode").single(),
  ]);
  const testMode = mode?.value === "test";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{tr("Portefeuille Baobab")}</h1>
      <p className="mt-1 text-muted">{tr("Un seul portefeuille pour les primes, le mentorat, le clone IA et la Centrale d'achat.")}</p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-muted">{tr("Solde disponible")}{" "}{testMode && tr("(mode test)")}</p>
        <p className="mt-1 font-mono text-4xl font-bold">{fcfa(wallet?.balance ?? 0)}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {testMode ? (
            <form action={testTopup} className="flex gap-2">
              <select name="amount" className="rounded-full border border-border bg-background px-3 text-sm">
                <option value="5000">{tr("5 000 FCFA")}</option>
                <option value="25000">{tr("25 000 FCFA")}</option>
                <option value="50000">{tr("50 000 FCFA")}</option>
              </select>
              <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">{tr("Recharger (test)")}</button>
            </form>
          ) : (
            <span className="rounded-full border border-border px-4 py-2 text-sm text-muted">{tr("Recharge Mobile Money : V1")}</span>
          )}
          <button disabled className="rounded-full border border-border px-4 py-2 text-sm text-muted" title={tr("Disponible en V1 avec FedaPay, Kkiapay ou CinetPay")}>
            {tr("Retirer vers Mobile Money, Wave, Orange Money (V1)")}
          </button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">{tr("Historique")}</h2>
        <p className="text-xs text-muted">{tr("Journal en ajout seul : chaque ligne est chaînée à la précédente par une empreinte SHA-256.")}</p>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
          {transactions?.length ? (
            transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p>
                    {KIND[t.kind] ?? t.kind}
                    {t.ref_type === "bounty" && t.ref_id && (
                      <Link href={`/bourse/${t.ref_id}`} className="ml-2 text-xs text-primary">
                        {tr("voir le ticket")}
                      </Link>
                    )}
                  </p>
                  <p className="truncate font-mono text-xs text-muted" title={t.hash}>
                    {new Date(t.created_at).toLocaleString(dateLocale())} · #{t.hash.slice(0, 12)}
                  </p>
                </div>
                <span className={`shrink-0 font-mono font-semibold ${t.amount >= 0 ? "text-leaf" : "text-primary"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {fcfa(t.amount)}
                </span>
              </li>
            ))
          ) : (
            <li className="px-4 py-6 text-center text-muted">{tr("Aucune transaction.")}</li>
          )}
        </ul>
      </section>
    </main>
  );
}
