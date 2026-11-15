import { dateLocale } from "@/lib/i18n/current";
import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { INFRA_CATEGORY, INFRA_UNIT, PAUSE_REASON, price, saving } from "@/lib/centrale-labels";
import { joinCentrale, propose, setBudget, vote } from "./actions";

export async function generateMetadata() {
  return { title: await pageTitle("Centrale d'achat · Baobab Dev") };
}

type Offer = { id: string; code: string; category: string; name: string; provider: string; description: string; unit: string; billing_mode: string; price: number; public_price: number };

export default async function CentralePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  const { error } = await searchParams;
  const { supabase, user } = await getSession();

  const [{ data: offers }, { data: member }, { data: proposals }] = await Promise.all([
    supabase.from("infra_offers").select("*").eq("active", true).order("category"),
    user ? supabase.from("infra_members").select("joined_at").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("infra_proposals").select("id, title, description, status, created_at, infra_proposal_votes(user_id)").order("created_at", { ascending: false }),
  ]);

  let dashboard: null | {
    wallet: number;
    credits: number;
    spend: number;
    cap: number | null;
    resources: { id: string; name: string; status: string; pause_reason: string | null; created_at: string; offer: Offer }[];
    daily: { day: string; amount: number }[];
  } = null;
  if (user && member) {
    const [{ data: wallet }, { data: credits }, { data: spend }, { data: budget }, { data: resources }, { data: daily }] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user.id).single(),
      supabase.from("infra_credits").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("infra_month_spend", { p_user: user.id }),
      supabase.from("infra_budgets").select("monthly_cap").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("infra_resources")
        .select("id, name, status, pause_reason, created_at, offer:infra_offers(*)")
        .eq("owner_id", user.id)
        .neq("status", "deleted")
        .order("created_at"),
      supabase.rpc("infra_daily_usage"),
    ]);
    dashboard = {
      wallet: wallet?.balance ?? 0,
      credits: credits?.balance ?? 0,
      spend: (spend as number) ?? 0,
      cap: budget?.monthly_cap ?? null,
      resources: (resources ?? []) as unknown as NonNullable<typeof dashboard>["resources"],
      daily: (daily ?? []) as { day: string; amount: number }[],
    };
  }
  const maxDay = Math.max(1, ...(dashboard?.daily.map((d) => d.amount) ?? [1]));
  const pct = dashboard?.cap ? Math.min(100, Math.round((dashboard.spend / dashboard.cap) * 100)) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Centrale d'achat d'infrastructures")}</h1>
      <p className="mt-1 max-w-3xl text-muted">
        {t("Une coopérative qui donne aux indépendants la puissance d'achat d'une grande entreprise : cloud, bases de données, SMS, IA et monitoring au prix de gros, payables en Mobile Money, sans carte bancaire internationale ni abonnement fixe.")}
      </p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {!user ? (
        <p className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
          <Link href="/login?next=/centrale" className="text-primary">
            {t("Connecte-toi")}
          </Link>{" "}
          {t("pour adhérer à la coopérative (gratuit).")}
        </p>
      ) : !member ? (
        <form action={joinCentrale} className="mt-6 rounded-2xl border border-primary bg-surface p-5">
          <p className="font-semibold">{t("Adhérer à la coopérative")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("Gratuit. Tu paies uniquement ce que tu consommes, depuis ton portefeuille Baobab (recharge Mobile Money dès 1 000 FCFA). Tu votes les prochains services négociés et tu touches une ristourne annuelle selon ton volume.")}
          </p>
          <button className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">{t("Adhérer")}</button>
        </form>
      ) : (
        dashboard && (
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm text-muted">{t("Disponible")}</p>
              <p className="font-mono text-2xl font-bold">{fcfa(dashboard.wallet + dashboard.credits)}</p>
              <p className="text-xs text-muted">
                {t("dont")}{" "}{fcfa(dashboard.credits)}{" "}{t("de crédits offerts, utilisés en premier ·")}{" "}
                <Link href="/portefeuille" className="text-primary">
                  {t("recharger")}
                </Link>
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 lg:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-muted">{t("Consommé ce mois-ci")}</p>
                <p className="font-mono text-2xl font-bold">
                  {fcfa(dashboard.spend)}
                  {dashboard.cap && <span className="text-sm font-normal text-muted"> / {fcfa(dashboard.cap)}</span>}
                </p>
              </div>
              {pct !== null && (
                <div className="relative mt-2 h-3 rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: pct >= 80 ? "var(--danger)" : pct >= 50 ? "var(--gold)" : "var(--leaf)" }}
                  />
                  {[50, 80].map((m) => (
                    <span key={m} className="absolute top-0 h-3 w-px bg-foreground/40" style={{ left: `${m}%` }} />
                  ))}
                </div>
              )}
              <div className="mt-3 flex h-16 items-end gap-0.5" role="img" aria-label={t("Consommation des 30 derniers jours")}>
                {dashboard.daily.map((d) => (
                  <span
                    key={d.day}
                    title={`${new Date(d.day).toLocaleDateString(dateLocale())} : ${fcfa(d.amount)}`}
                    className="flex-1 rounded-t-sm bg-leaf"
                    style={{ height: `${Math.max(2, (d.amount / maxDay) * 100)}%`, opacity: d.amount ? 1 : 0.2 }}
                  />
                ))}
              </div>
              <form action={setBudget} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="cap" className="text-muted">
                  {t("Plafond mensuel")}
                </label>
                <input id="cap" name="cap" type="number" min={500} step={500} defaultValue={dashboard.cap ?? 10000} className="w-32 rounded-lg border border-border bg-background px-2 py-1" />
                <button className="rounded-lg border border-border px-3 py-1">{t("Enregistrer")}</button>
                <span className="text-xs text-muted">{t("Alertes à 50, 80 et 100 %, puis pause automatique.")}</span>
              </form>
            </div>

            <div className="lg:col-span-3">
              <h2 className="font-semibold">{t("Mes ressources (")}{dashboard.resources.length}/5)</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.resources.map((r) => (
                  <li key={r.id}>
                    <Link href={`/centrale/ressources/${r.id}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-primary">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium">{r.name}</span>
                        <span className={`flex items-center gap-1.5 text-xs ${r.status === "active" ? "text-leaf" : "text-primary"}`}>
                          <span className={`h-2 w-2 rounded-full ${r.status === "active" ? "bg-leaf" : "bg-primary"}`} />
                          {r.status === "active" ? t("active") : `en pause (${PAUSE_REASON[r.pause_reason ?? "manuel"]})`}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {r.offer.name} · {price(r.offer.price)} / {INFRA_UNIT[r.offer.unit]}
                      </p>
                    </Link>
                  </li>
                ))}
                {!dashboard.resources.length && <li className="text-sm text-muted">{t("Aucune ressource : choisis une offre ci-dessous.")}</li>}
              </ul>
            </div>
          </section>
        )
      )}

      <section className="mt-10">
        <h2 className="font-semibold">{t("Catalogue négocié")}</h2>
        <p className="text-xs text-muted">{t("Prix de gros + 10 à 15 % de marge coopérative, toujours sous le prix public. Facturation au réel.")}</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {((offers ?? []) as Offer[]).map((o) => (
            <li key={o.id} className="flex flex-col rounded-xl border border-border bg-surface p-4">
              <span className="text-xs text-muted">{INFRA_CATEGORY[o.category]}</span>
              <p className="font-semibold">{o.name}</p>
              <p className="mt-1 flex-1 text-sm text-muted">{o.description}</p>
              <p className="mt-3 font-mono text-lg font-bold">
                {price(o.price)}
                <span className="text-xs font-normal text-muted"> / {INFRA_UNIT[o.unit]}</span>
              </p>
              <p className="text-xs">
                <span className="text-muted line-through">{price(o.public_price)}</span>{" "}
                <span className="font-medium text-leaf">−{saving(o.price, o.public_price)} %</span>
              </p>
              <p className="mt-1 text-[11px] text-muted">{o.provider}</p>
              {member && (
                <Link href={`/centrale/nouvelle?offre=${o.code}`} className="mt-3 rounded-full bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-ink">
                  {o.billing_mode === "unique" ? t("Réserver") : t("Créer")}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-semibold">{t("Les membres votent les prochaines négociations")}</h2>
          <ul className="mt-3 space-y-2">
            {proposals?.map((p) => {
              const voters = (p.infra_proposal_votes as { user_id: string }[]).map((v) => v.user_id);
              const mine = user ? voters.includes(user.id) : false;
              return (
                <li key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{p.title}</p>
                    {p.description && <p className="text-xs text-muted">{p.description}</p>}
                    <p className="text-xs text-muted">
                      {p.status === "open" ? t("ouverte") : p.status === "negotiating" ? t("en négociation") : p.status === "available" ? t("disponible") : t("écartée")} ·{" "}
                      {timeAgo(p.created_at)}
                    </p>
                  </div>
                  {member && p.status === "open" ? (
                    <form action={vote.bind(null, p.id)}>
                      <button className={`shrink-0 rounded-full px-3 py-1 text-xs ${mine ? "bg-leaf text-background" : "border border-border"}`}>
                        ▲ {voters.length}
                      </button>
                    </form>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">▲ {voters.length}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {member && (
            <form action={propose} className="mt-3 flex flex-wrap gap-2">
              <input name="title" required minLength={5} maxLength={120} placeholder={t("Un service à négocier")} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
              <button className="rounded-lg border border-border px-3 text-sm">{t("Proposer")}</button>
            </form>
          )}
        </div>
        <div className="space-y-3 text-sm">
          <h2 className="font-semibold">{t("Comment fonctionne la coopérative")}</h2>
          <p className="text-muted">
            <strong className="text-foreground">{t("Prépayé, jamais de facture surprise.")}</strong>{" "}{t("La consommation est déduite en temps réel. À ton plafond mensuel ou à solde nul, tes ressources se mettent en pause au lieu de s'endetter.")}
          </p>
          <p className="text-muted">
            <strong className="text-foreground">{t("Ristourne annuelle.")}</strong>{" "}{t("20 % de la marge de l'année est reversée aux membres, en crédits, au prorata de leur consommation.")}
          </p>
          <p className="text-muted">
            <strong className="text-foreground">{t("Crédits offerts.")}</strong>{" "}{t("Les lauréats des défis et les projets de la semaine reçoivent des crédits d'infrastructure.")}
          </p>
          <p className="text-muted">
            <strong className="text-foreground">{t("Isolation et sécurité.")}</strong>{" "}{t("5 ressources par compte, détection de l'envoi massif de SMS, sauvegardes quotidiennes des bases.")}
          </p>
        </div>
      </section>
    </main>
  );
}
