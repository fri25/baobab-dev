import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { INFRA_UNIT, price, saving } from "@/lib/centrale-labels";
import { slugify } from "@/lib/format";
import { CreateResourceForm } from "./CreateResourceForm";

export const metadata = { title: "Nouvelle ressource · Centrale d'achat" };

export default async function NewResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ offre?: string; projet?: string; squad?: string }>;
}) {
  const { offre, projet, squad } = await searchParams;
  const { supabase, user } = await requireSession("/centrale/nouvelle");

  const { data: member } = await supabase.from("infra_members").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!member) redirect("/centrale?error=" + encodeURIComponent("Adhère d'abord à la Centrale d'achat (gratuit)."));

  // Depuis un projet ou une Squad sans offre choisie : on propose les offres
  const { data: offers } = await supabase.from("infra_offers").select("code, name, description, price, public_price, unit").eq("active", true).order("category");
  const offer = offers?.find((o) => o.code === offre);
  if (offre && !offer) notFound();

  const [{ data: projects }, { data: owned }, { data: memberOf }] = await Promise.all([
    supabase.from("projects").select("id, name, slug").eq("owner_id", user.id),
    supabase.from("squads").select("id, name").eq("owner_id", user.id),
    supabase.from("squad_members").select("squad:squads(id, name)").eq("user_id", user.id).eq("status", "member"),
  ]);
  const squads = [...(owned ?? []), ...((memberOf ?? []).map((m) => m.squad) as unknown as { id: string; name: string }[])];
  const project = projects?.find((p) => p.id === projet);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/centrale" className="text-sm text-muted hover:text-primary">
        ← Centrale d&apos;achat
      </Link>
      {!offer ? (
        <>
          <h1 className="mt-2 text-2xl font-bold">Héberger {project ? project.name : "un projet"}</h1>
          <ul className="mt-6 space-y-2">
            {offers?.map((o) => (
              <li key={o.code}>
                <Link
                  href={`/centrale/nouvelle?offre=${o.code}${projet ? `&projet=${projet}` : ""}${squad ? `&squad=${squad}` : ""}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary"
                >
                  <span>
                    <span className="font-medium">{o.name}</span>
                    <span className="block text-sm text-muted">{o.description}</span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-sm">
                    {price(o.price)}
                    <span className="block text-xs text-muted">/ {INFRA_UNIT[o.unit]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h1 className="mt-2 text-2xl font-bold">{offer.name}</h1>
          <p className="mt-1 text-muted">{offer.description}</p>
          <p className="mt-2 text-sm">
            <strong className="font-mono">
              {price(offer.price)} / {INFRA_UNIT[offer.unit]}
            </strong>{" "}
            <span className="text-muted line-through">{price(offer.public_price)}</span>{" "}
            <span className="text-leaf">−{saving(offer.price, offer.public_price)} %</span> · déduit de tes crédits puis de ton portefeuille.
          </p>
          <div className="mt-6">
            <CreateResourceForm
              offerCode={offer.code}
              offerName={offer.name}
              defaultName={`${project ? slugify(project.name) : "mon-projet"}-${offer.code}`}
              projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name }))}
              squads={squads}
              projectId={projet}
              squadId={squad}
            />
          </div>
        </>
      )}
    </main>
  );
}
