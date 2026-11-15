import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { levelForXp } from "@/lib/levels";

export async function generateMetadata() {
  return { title: await pageTitle("Clones IA · Baobab Dev") };
}

type Stats = { clone_id: string; questions: number; avg_rating: number | null; ratings: number };

export default async function ClonesPage() {
  const t = await getT();
  const { supabase, profile } = await getSession();
  const [{ data: clones }, { data: stats }, { data: mine }] = await Promise.all([
    supabase
      .from("ai_clones")
      .select("id, name, specialty, description, owner:profiles!ai_clones_owner_id_fkey(username, full_name, avatar_url, city, xp)")
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    supabase.rpc("clone_public_stats"),
    profile ? supabase.from("ai_clones").select("id").eq("owner_id", profile.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const statOf = new Map(((stats ?? []) as Stats[]).map((s) => [s.clone_id, s]));
  const canCreate = profile && profile.xp >= 2000;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("Clones IA des seniors")}</h1>
          <p className="max-w-2xl text-muted">
            {t("Le savoir des seniors, disponible à toute heure. Chaque clone répond uniquement à partir des contenus de son senior, et lui reverse 70 % des revenus. Première question gratuite, puis 100 FCFA, ou 2 000 FCFA par mois pour tous les clones avec le Pass.")}
          </p>
        </div>
        {mine ? (
          <Link href="/clones/mon-clone" className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">
            {t("Mon clone")}
          </Link>
        ) : canCreate ? (
          <Link href="/clones/mon-clone" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
            {t("Créer mon clone")}
          </Link>
        ) : (
          <span className="rounded-full border border-border px-4 py-2 text-xs text-muted">{t("Création dès le niveau Expert (2 000 XP)")}</span>
        )}
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {clones?.map((c) => {
          const owner = c.owner as unknown as { username: string; full_name: string | null; avatar_url: string | null; city: string | null; xp: number };
          const s = statOf.get(c.id);
          return (
            <li key={c.id}>
              <Link href={`/clones/${c.id}`} className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 hover:border-primary">
                <div className="flex items-center gap-3">
                  <Avatar user={owner} size={44} />
                  <div className="min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted">
                      {t("Clone de")}{" "}{owner.full_name ?? owner.username} · {levelForXp(owner.xp).name}
                      {owner.city && ` · ${owner.city}`}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium">{c.specialty}</p>
                {c.description && <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted">{c.description}</p>}
                <p className="mt-3 text-xs text-muted">
                  {s?.avg_rating ? `★ ${s.avg_rating} (${s.ratings} avis) · ` : ""}
                  {s?.questions ?? 0}{" "}{t("question(s) traitée(s)")}
                </p>
              </Link>
            </li>
          );
        })}
        {!clones?.length && <li className="text-sm text-muted">{t("Aucun clone publié pour l'instant.")}</li>}
      </ul>
    </main>
  );
}
