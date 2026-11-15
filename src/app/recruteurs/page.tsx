import { dateLocale } from "@/lib/i18n/current";
import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { fcfa, parseTags } from "@/lib/format";
import { LEVELS, levelForXp } from "@/lib/levels";
import { AVAILABILITY, CONTACT_STATUS, type Evidence, evidenceItems, OPEN_TO } from "@/lib/recruiter-labels";
import { subscribe, toggleShortlist } from "./actions";

export async function generateMetadata() {
  return { title: await pageTitle("Espace recruteurs · Baobab Dev") };
}

type Status = {
  active: boolean;
  price: number;
  quota: number;
  used?: number;
  company?: string;
  ends_at?: string;
  last_company?: string | null;
};
type Stats = {
  visible: number;
  verified: number;
  available: number;
  countries: { country: string; n: number }[];
  top_skills: { skill: string; n: number }[];
};
type Talent = {
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  xp: number;
  availability: string;
  open_to: string[];
  skills: string[];
  matched_skills: string[];
  evidence: Evidence;
  score: number;
  shortlisted: boolean;
  contacted: string | null;
};
type Search = { q?: string; skills?: string; pays?: string; ville?: string; niveau?: string; dispo?: string; contrat?: string; verifies?: string; error?: string; abonne?: string };

const input = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default async function RecruitersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const tr = await getT();
  const sp = await searchParams;
  const { supabase, user } = await getSession();
  const [{ data: status }, { data: stats }] = await Promise.all([
    user ? supabase.rpc("my_recruiter_status") : Promise.resolve({ data: null }),
    supabase.rpc("talent_pool_stats"),
  ]);
  const s = (status ?? { active: false, price: 25000, quota: 20 }) as Status;
  const pool = stats as Stats;

  if (!s.active) return <Pitch user={!!user} status={s} pool={pool} error={sp.error} />;

  const skills = parseTags(sp.skills ?? null);
  const minXp = LEVELS.find((l) => String(l.level) === sp.niveau)?.floor ?? 0;
  const { data, error } = await supabase.rpc("search_talents", {
    p_query: sp.q || null,
    p_skills: skills,
    p_country: sp.pays || null,
    p_city: sp.ville || null,
    p_min_xp: minXp,
    p_availability: sp.dispo || null,
    p_open_to: sp.contrat || null,
    p_verified_only: sp.verifies === "on",
    p_limit: 30,
  });
  const talents = (data ?? []) as Talent[];
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["error", "abonne"].includes(k)) as [string, string][]).toString();
  const back = `/recruteurs${qs ? `?${qs}` : ""}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{tr("Espace recruteurs ·")}{" "}{s.company}</p>
          <h1 className="text-2xl font-bold">{tr("Trouver des talents vérifiés")}</h1>
          <p className="text-sm text-muted">
            {tr("Abonnement actif jusqu'au")}{" "}{new Date(s.ends_at!).toLocaleDateString(dateLocale())}{" "}{tr("· prises de contact :")}{" "}{s.used}/{s.quota}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/recruteurs/selection" className="rounded-full border border-border px-4 py-2 text-sm">
            {tr("Ma présélection et mes propositions")}
          </Link>
          <form action={subscribe}>
            <input type="hidden" name="company" value={s.company} />
            <button className="rounded-full border border-border px-4 py-2 text-sm text-muted" title={tr("Ajoute 30 jours à la fin de l'abonnement en cours")}>
              {tr("Prolonger 30 jours (")}{fcfa(s.price)})
            </button>
          </form>
        </div>
      </div>
      {sp.abonne && <p className="mt-4 rounded-lg bg-leaf/10 p-3 text-sm text-leaf">{tr("Abonnement activé. Bonne recherche !")}</p>}
      {(sp.error || error) && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{sp.error ?? error?.message}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <form className="h-fit space-y-3 rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-20">
          <label className="block text-sm font-medium">
            {tr("Mots-clés")}
            <input name="q" defaultValue={sp.q} placeholder={tr("paiement, USSD, nom…")} className={input} />
          </label>
          <label className="block text-sm font-medium">
            {tr("Technologies (toutes optionnelles)")}
            <input name="skills" defaultValue={sp.skills} placeholder={tr("Laravel, Flutter")} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm font-medium">
              {tr("Pays")}
              <select name="pays" defaultValue={sp.pays} className={input}>
                <option value="">{tr("Tous")}</option>
                {pool.countries.map((c) => (
                  <option key={c.country}>{c.country}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              {tr("Ville")}
              <input name="ville" defaultValue={sp.ville} className={input} />
            </label>
          </div>
          <label className="block text-sm font-medium">
            {tr("Niveau minimum")}
            <select name="niveau" defaultValue={sp.niveau} className={input}>
              {LEVELS.map((l) => (
                <option key={l.level} value={l.level}>
                  {l.name} ({l.floor}{" "}{tr("XP)")}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm font-medium">
              {tr("Disponibilité")}
              <select name="dispo" defaultValue={sp.dispo} className={input}>
                <option value="">{tr("Toutes")}</option>
                {Object.entries(AVAILABILITY).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              {tr("Ouvert·e à")}
              <select name="contrat" defaultValue={sp.contrat} className={input}>
                <option value="">{tr("Tout")}</option>
                {OPEN_TO.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="verifies" defaultChecked={sp.verifies === "on"} />{" "}{tr("Profils vérifiés uniquement")}
          </label>
          <button className="w-full rounded-full bg-primary py-2 text-sm font-medium text-primary-ink">{tr("Rechercher")}</button>
          <Link href="/recruteurs" className="block text-center text-xs text-muted">
            {tr("Réinitialiser")}
          </Link>
        </form>

        <section>
          <p className="text-sm text-muted">
            {talents.length}{" "}{tr("profil")}{talents.length > 1 ? "s" : ""}{" "}{tr("· classés par compétences demandées, preuves vérifiables et réputation")}
          </p>
          <ul className="mt-3 space-y-3">
            {talents.map((t) => (
              <li key={t.user_id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <Avatar user={t} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/recruteurs/talents/${t.username}`} className="font-semibold hover:text-primary">
                        {t.full_name ?? t.username}
                      </Link>
                      {t.evidence.verified && <span className="rounded-full bg-leaf/15 px-2 py-0.5 text-xs font-medium text-leaf">{tr("✓ Vérifié")}</span>}
                      {t.contacted && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">{tr("Proposition")}{" "}{CONTACT_STATUS[t.contacted].toLowerCase()}</span>}
                    </div>
                    <p className="text-xs text-muted">
                      {[t.city, t.country].filter(Boolean).join(", ")} · {levelForXp(t.xp).name} ({t.xp}{" "}{tr("XP) ·")}{" "}{AVAILABILITY[t.availability]}
                    </p>
                    {t.bio && <p className="mt-1 line-clamp-2 text-sm">{t.bio}</p>}
                    <p className="mt-2 flex flex-wrap gap-1">
                      {t.skills.map((k) => (
                        <span key={k} className={`rounded px-1.5 py-0.5 font-mono text-xs ${t.matched_skills.includes(k) ? "bg-leaf/15 text-leaf" : "bg-background text-muted"}`}>
                          {k}
                        </span>
                      ))}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {evidenceItems(t.evidence)
                        .filter((e) => e.ok)
                        .map((e) => (
                          <span key={e.label} className="text-muted">
                            ✓ {e.label}
                          </span>
                        ))}
                      {t.open_to.length > 0 && <span className="text-primary">{tr("Ouvert·e à :")}{" "}{t.open_to.map((o) => OPEN_TO.find((x) => x.value === o)?.label).join(", ")}</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-mono text-lg font-bold" title={tr("Score de correspondance sur 100")}>
                      {t.score}
                    </span>
                    <form action={toggleShortlist.bind(null, t.user_id, back)}>
                      <button className={`rounded-full px-3 py-1 text-xs ${t.shortlisted ? "bg-foreground text-background" : "border border-border"}`}>
                        {t.shortlisted ? tr("★ Présélectionné·e") : tr("☆ Présélectionner")}
                      </button>
                    </form>
                    <Link href={`/recruteurs/talents/${t.username}`} className="text-xs text-primary">
                      {tr("Voir la fiche →")}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
            {!talents.length && <li className="rounded-xl border border-border bg-surface p-6 text-center text-muted">{tr("Aucun profil ne correspond. Élargis les filtres.")}</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}

async function Pitch({ user, status, pool, error }: { user: boolean; status: Status; pool: Stats; error?: string }) {
  const tr = await getT();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">{tr("Espace recruteurs")}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        {tr("Repérez des développeurs africains sur des preuves, pas sur des CV : réponses acceptées par la communauté, Squads menées à terme, primes gagnées, défis, audits et dépôts GitHub reliés.")}
      </p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { n: pool.visible, l: "profils ouverts aux recruteurs" },
          { n: pool.verified, l: "profils vérifiés" },
          { n: pool.available, l: "disponibles maintenant" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-surface p-4">
            <p className="font-mono text-3xl font-bold">{k.n}</p>
            <p className="text-sm text-muted">{k.l}</p>
          </div>
        ))}
      </div>
      {pool.top_skills.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-1 text-sm">
          <span className="mr-1 text-muted">{tr("Technologies les plus représentées :")}</span>
          {pool.top_skills.map((t) => (
            <span key={t.skill} className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
              {t.skill} · {t.n}
            </span>
          ))}
        </p>
      )}

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="space-y-3 text-sm">
          <h2 className="text-lg font-semibold">{tr("Ce que comprend l'abonnement")}</h2>
          <ul className="space-y-2">
            <li>{tr("✓ Recherche avancée : technologies, pays, ville, niveau, disponibilité, type de contrat")}</li>
            <li>{tr("✓ Statut « vérifié » calculé sur l'activité réelle, jamais déclaratif")}</li>
            <li>{tr("✓ Présélection avec notes privées")}</li>
            <li>✓ {status.quota}{" "}{tr("propositions de contact par période de 30 jours")}</li>
          </ul>
          <h2 className="pt-2 text-lg font-semibold">{tr("Le dev garde la main")}</h2>
          <p className="text-muted">
            {tr("Seuls les devs qui l'acceptent apparaissent dans la recherche. Vous envoyez une proposition ; la conversation ne s'ouvre que si le dev l'accepte. Après un refus, vous ne pouvez pas le relancer pendant 30 jours.")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="font-mono text-3xl font-bold">{fcfa(status.price)}</p>
          <p className="text-sm text-muted">{tr("pour 30 jours, payés depuis le portefeuille Baobab, sans engagement")}</p>
          {user ? (
            <form action={subscribe} className="mt-4 space-y-3">
              <label className="block text-sm font-medium">
                {tr("Structure (entreprise, ONG, collectivité)")}
                <input name="company" required minLength={2} defaultValue={status.last_company ?? ""} className={input} />
              </label>
              <button className="w-full rounded-full bg-primary py-2 text-sm font-medium text-primary-ink">{tr("S'abonner")}</button>
              <Link href="/portefeuille" className="block text-center text-xs text-muted">
                {tr("Recharger le portefeuille")}
              </Link>
            </form>
          ) : (
            <Link href="/login?next=/recruteurs" className="mt-4 block rounded-full bg-primary py-2 text-center text-sm font-medium text-primary-ink">
              {tr("Se connecter pour s'abonner")}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
