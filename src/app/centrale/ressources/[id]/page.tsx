import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { INFRA_CATEGORY, INFRA_UNIT, PAUSE_REASON, price } from "@/lib/centrale-labels";
import { setResourceStatus } from "../../actions";

export default async function ResourcePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await getSession();

  const { data: r } = await supabase
    .from("infra_resources")
    .select("id, owner_id, name, status, pause_reason, api_key_prefix, last_backup_at, created_at, offer:infra_offers(*), project:projects(name, slug), squad:squads(id, name)")
    .eq("id", id)
    .neq("status", "deleted")
    .maybeSingle();
  if (!r) notFound();
  const offer = r.offer as unknown as { name: string; category: string; unit: string; price: number; provider: string; billing_mode: string };
  const project = r.project as unknown as { name: string; slug: string } | null;
  const squad = r.squad as unknown as { id: string; name: string } | null;
  const isOwner = user?.id === r.owner_id;

  const { data: usage } = await supabase
    .from("usage_records")
    .select("id, quantity, unit, amount, from_credits, created_at")
    .eq("resource_id", id)
    .order("created_at", { ascending: false })
    .limit(30);
  const total = (usage ?? []).reduce((n, u) => n + u.amount, 0);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/centrale" className="text-sm text-muted hover:text-primary">
        ← Centrale d&apos;achat
      </Link>
      {error && <p className="mt-3 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {INFRA_CATEGORY[offer.category]} · {offer.provider}
          </p>
          <h1 className="font-mono text-2xl font-bold">{r.name}</h1>
          <p className="text-sm text-muted">
            {offer.name} · {price(offer.price)} / {INFRA_UNIT[offer.unit]} · créée {timeAgo(r.created_at)}
            {project && (
              <>
                {" "}
                · projet{" "}
                <Link href={`/showroom/${project.slug}`} className="text-primary">
                  {project.name}
                </Link>
              </>
            )}
            {squad && (
              <>
                {" "}
                · Squad{" "}
                <Link href={`/squads/${squad.id}`} className="text-primary">
                  {squad.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${r.status === "active" ? "bg-leaf/10 text-leaf" : "bg-primary/10 text-primary"}`}>
          <span className={`h-2 w-2 rounded-full ${r.status === "active" ? "bg-leaf" : "bg-primary"}`} />
          {r.status === "active" ? "Active" : `En pause : ${PAUSE_REASON[r.pause_reason ?? "manuel"]}`}
        </span>
      </div>

      {isOwner && offer.billing_mode !== "unique" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.status === "active" ? (
            <form action={setResourceStatus.bind(null, id, "paused")}>
              <button className="rounded-full border border-border px-4 py-1.5 text-sm">Mettre en pause</button>
            </form>
          ) : (
            <form action={setResourceStatus.bind(null, id, "active")}>
              <button className="rounded-full bg-leaf px-4 py-1.5 text-sm font-medium text-background">Reprendre</button>
            </form>
          )}
          <form action={setResourceStatus.bind(null, id, "deleted")}>
            <button className="rounded-full px-4 py-1.5 text-sm text-muted hover:text-primary">Supprimer</button>
          </form>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-semibold">Utilisation</h2>
          {offer.category === "ia" && (
            <div className="mt-2 text-sm">
              <p className="text-muted">
                Clé <code className="font-mono">{r.api_key_prefix}…</code>, compatible avec l&apos;API Messages. Facturation au millier de jetons
                (entrée + sortie).
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-[#1f1a14] p-3 text-xs text-[#f3ece2]">{`curl ${base}/api/centrale/ia/v1/messages \\
  -H "x-api-key: $BAOBAB_KEY" \\
  -H "content-type: application/json" \\
  -d '{"model":"claude-opus-5-5","max_tokens":1000,
       "messages":[{"role":"user","content":"Bonjour"}]}'`}</pre>
            </div>
          )}
          {offer.category === "sms" && (
            <div className="mt-2 text-sm">
              <p className="text-muted">
                Clé <code className="font-mono">{r.api_key_prefix}…</code>. Un SMS = 160 caractères. Limite anti-spam : 100 SMS par heure, au-delà la
                ressource est suspendue. Bac à sable : les SMS sont validés et facturés, la transmission aux opérateurs arrive avec la passerelle
                régionale.
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-[#1f1a14] p-3 text-xs text-[#f3ece2]">{`curl ${base}/api/centrale/sms \\
  -H "x-api-key: $BAOBAB_KEY" \\
  -H "content-type: application/json" \\
  -d '{"to":"+22997000000","message":"Votre cotisation est reçue"}'`}</pre>
            </div>
          )}
          {["calcul", "base_de_donnees", "build", "monitoring"].includes(offer.category) && (
            <p className="mt-2 text-sm text-muted">
              Facturée à l&apos;heure tant qu&apos;elle est active. Mets-la en pause quand tu ne t&apos;en sers pas.
              {offer.category === "base_de_donnees" && r.last_backup_at && ` Dernière sauvegarde automatique ${timeAgo(r.last_backup_at)}.`}
            </p>
          )}
          {offer.category === "domaine" && <p className="mt-2 text-sm text-muted">Réservé pour un an, DNS géré par la Centrale.</p>}
        </section>

        <section>
          <h2 className="font-semibold">Consommation récente · {fcfa(total)}</h2>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface text-sm">
            {usage?.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span>
                  {Number(u.quantity).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} {INFRA_UNIT[u.unit]}
                  <span className="block text-xs text-muted">
                    {new Date(u.created_at).toLocaleString("fr-FR")}
                    {u.from_credits > 0 && ` · ${fcfa(u.from_credits)} en crédits`}
                  </span>
                </span>
                <span className="font-mono">{fcfa(u.amount)}</span>
              </li>
            ))}
            {!usage?.length && <li className="px-4 py-3 text-muted">Aucune consommation pour l&apos;instant.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
