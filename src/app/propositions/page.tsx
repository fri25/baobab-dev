import { getT, pageTitle } from "@/lib/i18n/server";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { requireSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { CONTACT_STATUS, OFFER_KIND } from "@/lib/recruiter-labels";
import { respondContact } from "../recruteurs/actions";

export async function generateMetadata() {
  return { title: await pageTitle("Propositions · Baobab Dev") };
}

type Recruiter = { username: string; full_name: string | null; avatar_url: string | null };
type Views = { views_30d: number; companies: string[] };

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getT();
  const { error } = await searchParams;
  const { supabase, user } = await requireSession("/propositions");
  const [{ data: contacts }, { data: views }, { data: me }] = await Promise.all([
    supabase
      .from("recruiter_contacts")
      .select("id, company, title, offer_kind, message, budget, status, created_at, conversation_id, recruiter:profiles!recruiter_contacts_recruiter_id_fkey(username, full_name, avatar_url)")
      .eq("dev_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("my_recruiter_views"),
    supabase.from("profiles").select("recruiter_visible").eq("id", user.id).single(),
  ]);
  const v = (views ?? { views_30d: 0, companies: [] }) as Views;
  const pending = (contacts ?? []).filter((c) => c.status === "pending");
  const past = (contacts ?? []).filter((c) => c.status !== "pending");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Propositions de recruteurs")}</h1>
      <p className="mt-1 text-muted">{t("Aucun recruteur ne peut t'écrire sans ton accord : accepte pour ouvrir la conversation, ou décline.")}</p>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <section className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
        {me?.recruiter_visible ? (
          <p>
            <span className="font-mono text-lg font-bold">{v.views_30d}</span>{" "}{t("recruteur")}{v.views_30d > 1 ? t("s ont") : " a"}{" "}{t("consulté ta fiche ces 30 derniers jours")}
            {v.companies.length > 0 && <span className="text-muted"> : {v.companies.join(", ")}</span>}.
          </p>
        ) : (
          <p className="text-muted">{t("Ton profil est masqué aux recruteurs.")}</p>
        )}
        <Link href="/parametres" className="text-xs text-primary">
          {t("Visibilité et types de contrat →")}
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">{t("En attente ·")}{" "}{pending.length}</h2>
        <ul className="mt-3 space-y-3">
          {pending.map((c) => {
            const r = c.recruiter as unknown as Recruiter;
            return (
              <li key={c.id} className="rounded-xl border border-primary/40 bg-surface p-4">
                <div className="flex items-center gap-3">
                  <Avatar user={r} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted">
                      {c.company} · {OFFER_KIND[c.offer_kind]}
                      {c.budget && ` · ${c.budget}`} · {timeAgo(c.created_at)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm">{c.message}</p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <form action={respondContact.bind(null, c.id, true)}>
                    <button className="rounded-full bg-leaf px-5 py-2 text-sm font-medium text-background">{t("Accepter et discuter")}</button>
                  </form>
                  <form action={respondContact.bind(null, c.id, false)} className="flex flex-1 gap-2">
                    <input
                      name="reason"
                      maxLength={300}
                      placeholder={t("Raison (facultatif, transmise au recruteur)")}
                      className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 text-sm"
                    />
                    <button className="rounded-full border border-border px-4 py-2 text-sm">{t("Décliner")}</button>
                  </form>
                </div>
              </li>
            );
          })}
          {!pending.length && <li className="text-sm text-muted">{t("Aucune proposition en attente.")}</li>}
        </ul>
      </section>

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">{t("Historique")}</h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface text-sm">
            {past.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate">{c.title}</p>
                  <p className="text-xs text-muted">
                    {c.company} · {CONTACT_STATUS[c.status]} · {timeAgo(c.created_at)}
                  </p>
                </div>
                {c.conversation_id && (
                  <Link href={`/discussions/${c.conversation_id}`} className="shrink-0 text-xs text-primary">
                    {t("Conversation →")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
