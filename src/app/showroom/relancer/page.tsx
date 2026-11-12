import Link from "next/link";
import { UserChip } from "@/components/Avatar";
import { timeAgo } from "@/lib/format";
import { markdownSummary } from "@/lib/markdown";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Projets à relancer · Baobab Dev" };

type Person = { username: string; full_name: string | null; avatar_url: string | null; city: string | null };

// Projets prometteurs à l'arrêt, cédés par leur fondateur ou relancés avec une Squad (§7.3)
export default async function RevivePage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, description, stack, abandon_status, last_commit_at, repo_stars, repo_forks, unanswered_issues, squad_id, founder:profiles!projects_founder_id_fkey(username, full_name, avatar_url, city), owner:profiles!projects_owner_id_fkey(username, full_name, avatar_url, city)")
    .in("abandon_status", ["ceded", "revival"])
    .order("repo_stars", { ascending: false, nullsFirst: false });

  const ceded = (projects ?? []).filter((p) => p.abandon_status === "ceded");
  const revival = (projects ?? []).filter((p) => p.abandon_status === "revival");

  const Card = ({ p, cta }: { p: NonNullable<typeof projects>[number]; cta: string }) => (
    <li className="flex flex-col rounded-xl border border-border bg-surface p-5">
      <Link href={`/showroom/${p.slug}`} className="text-lg font-semibold hover:text-primary">
        {p.name}
      </Link>
      <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{markdownSummary(p.description)}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.stack.map((s: string) => (
          <span key={s} className="rounded bg-background px-2 py-0.5 font-mono text-xs">
            {s}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        ★ {p.repo_stars ?? 0} · {p.repo_forks ?? 0} fork(s) · {p.unanswered_issues ?? 0} issue(s) en attente
        {p.last_commit_at && ` · dernier commit ${timeAgo(p.last_commit_at)}`}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <UserChip user={(p.founder ?? p.owner) as unknown as Person} detail="fondateur" />
        <Link href={p.squad_id && p.abandon_status === "revival" ? `/squads/${p.squad_id}` : `/showroom/${p.slug}`} className="text-primary">
          {cta} →
        </Link>
      </div>
    </li>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/showroom" className="text-sm text-muted hover:text-primary">
        ← Showroom
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Projets à relancer</h1>
      <p className="max-w-2xl text-muted">
        Des projets prometteurs à l&apos;arrêt depuis plus de 6 mois, avec des étoiles et des issues qui attendent une réponse. Leurs
        fondateurs les cèdent ou cherchent du renfort : ils restent crédités.
      </p>

      <h2 className="mt-8 font-semibold">Cédés à la communauté</h2>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ceded.map((p) => (
          <Card key={p.id} p={p} cta="Le reprendre" />
        ))}
        {!ceded.length && <li className="text-sm text-muted">Aucun projet cédé pour l&apos;instant.</li>}
      </ul>

      <h2 className="mt-10 font-semibold">En relance, cherchent des collaborateurs</h2>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {revival.map((p) => (
          <Card key={p.id} p={p} cta="Rejoindre la Squad" />
        ))}
        {!revival.length && <li className="text-sm text-muted">Aucun pour l&apos;instant.</li>}
      </ul>
    </main>
  );
}
