import Link from "next/link";
import { notFound } from "next/navigation";
import { startDirect } from "@/app/discussions/actions";
import { Avatar } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { levelForXp } from "@/lib/levels";
import { buyPass } from "../actions";
import { CloneChat, type PastQuery } from "./CloneChat";

export default async function ClonePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await getSession();

  const { data: clone } = await supabase
    .from("ai_clones")
    .select("id, owner_id, name, specialty, description, status, owner:profiles!ai_clones_owner_id_fkey(id, username, full_name, avatar_url, city, xp)")
    .eq("id", id)
    .maybeSingle();
  if (!clone) notFound();
  const owner = clone.owner as unknown as { id: string; username: string; full_name: string | null; avatar_url: string | null; city: string | null; xp: number };
  const isOwner = user?.id === clone.owner_id;

  const [{ data: history }, { data: stats }, { data: pass }, { data: wallet }] = await Promise.all([
    user
      ? supabase
          .from("clone_queries")
          .select("id, question, answer, status, billing, price, rating, flagged_reason, refunded, created_at")
          .eq("clone_id", id)
          .eq("user_id", user.id)
          .order("created_at")
          .limit(20)
      : Promise.resolve({ data: [] }),
    supabase.rpc("clone_public_stats"),
    user
      ? supabase.from("clone_passes").select("month").eq("user_id", user.id).gte("month", new Date().toISOString().slice(0, 8) + "01").maybeSingle()
      : Promise.resolve({ data: null }),
    user ? supabase.from("wallets").select("balance").eq("user_id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  const s = (stats as { clone_id: string; questions: number; avg_rating: number | null; ratings: number }[] | null)?.find((x) => x.clone_id === id);
  const past = (history ?? []) as PastQuery[];
  const billed = past.some((q) => q.billing !== "not_billed");

  const billingHint = isOwner
    ? "Mode test : tes propres questions ne sont jamais facturées."
    : !billed
      ? "Ta première question est offerte. Hors domaine ou sans source : jamais facturé."
      : pass
        ? "Pass Clones actif : questions illimitées ce mois-ci."
        : `100 FCFA par question · solde ${fcfa(wallet?.balance ?? 0)} · hors domaine ou sans source : jamais facturé.`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/clones" className="text-sm text-muted hover:text-primary">
        ← Clones IA
      </Link>
      {clone.status !== "published" && (
        <p className="mt-3 rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 text-sm text-gold">
          {clone.status === "suspended" ? "Clone suspendu (note trop basse)." : "Brouillon : toi seul peux le tester."}
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <section className="mt-4 flex flex-wrap items-start gap-4">
        <Avatar user={owner} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{clone.name}</h1>
          <p className="text-sm text-muted">
            Clone IA de{" "}
            <Link href={`/u/${owner.username}`} className="text-foreground hover:text-primary">
              {owner.full_name ?? owner.username}
            </Link>{" "}
            · {levelForXp(owner.xp).name}
            {s?.avg_rating && ` · ★ ${s.avg_rating} (${s.ratings} avis)`}
          </p>
          <p className="mt-2 font-medium">{clone.specialty}</p>
          {clone.description && <p className="mt-1 text-sm text-muted">{clone.description}</p>}
        </div>
      </section>

      <p className="mt-4 rounded-xl border border-border bg-surface p-3 text-xs text-muted">
        🤖 Ceci est une IA. Elle répond uniquement à partir des contenus que {owner.full_name ?? owner.username} a choisis, et cite
        ses sources. Au-delà de ses limites, réserve une session de mentorat avec le vrai senior.
      </p>

      {!isOwner && user && (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={startDirect.bind(null, owner.id)}>
            <button className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-surface">
              Mentorat avec {owner.full_name?.split(" ")[0] ?? owner.username}
            </button>
          </form>
          {!pass && billed && (
            <form action={buyPass.bind(null, id)}>
              <button className="rounded-full bg-gold px-4 py-1.5 text-sm font-medium text-background">
                Pass Clones : 2 000 FCFA / mois, tous les clones
              </button>
            </form>
          )}
        </div>
      )}

      <div className="mt-8">
        {user ? (
          <CloneChat cloneId={id} history={past} isOwner={isOwner} billingHint={billingHint} />
        ) : (
          <p className="rounded-xl border border-border bg-surface p-4 text-center text-sm">
            <Link href={`/login?next=/clones/${id}`} className="text-primary">
              Connecte-toi
            </Link>{" "}
            pour poser ta première question gratuite.
          </p>
        )}
      </div>
    </main>
  );
}
