import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { requireSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { levelForXp } from "@/lib/levels";
import { CONTACT_STATUS, OFFER_KIND } from "@/lib/recruiter-labels";
import { toggleShortlist } from "../actions";

export const metadata = { title: "Présélection · Espace recruteurs" };

type Dev = { id: string; username: string; full_name: string | null; avatar_url: string | null; city: string | null; country: string | null; xp: number };

const STATUS_CLASS: Record<string, string> = {
  pending: "border border-border text-muted",
  accepted: "bg-leaf/15 text-leaf",
  declined: "bg-primary/10 text-primary",
  expired: "border border-border text-muted",
};

export default async function SelectionPage() {
  const { supabase, user } = await requireSession("/recruteurs/selection");
  const { data: status } = await supabase.rpc("my_recruiter_status");
  if (!(status as { active: boolean }).active) redirect("/recruteurs");

  const [{ data: shortlist }, { data: contacts }] = await Promise.all([
    supabase
      .from("recruiter_shortlist")
      .select("note, created_at, dev:profiles!recruiter_shortlist_dev_id_fkey(id, username, full_name, avatar_url, city, country, xp)")
      .eq("recruiter_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("recruiter_contacts")
      .select("id, title, offer_kind, status, created_at, responded_at, conversation_id, decline_reason, dev:profiles!recruiter_contacts_dev_id_fkey(username, full_name, avatar_url)")
      .eq("recruiter_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const accepted = (contacts ?? []).filter((c) => c.status === "accepted").length;
  const answered = (contacts ?? []).filter((c) => c.status === "accepted" || c.status === "declined").length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/recruteurs" className="text-sm text-muted hover:text-primary">
        ← Recherche
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Présélection et propositions</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-semibold">Présélection · {shortlist?.length ?? 0}</h2>
          <ul className="mt-3 space-y-2">
            {(shortlist ?? []).map((s) => {
              const d = s.dev as unknown as Dev;
              return (
                <li key={d.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
                  <Avatar user={d} size={40} />
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={`/recruteurs/talents/${d.username}`} className="font-medium hover:text-primary">
                      {d.full_name ?? d.username}
                    </Link>
                    <p className="text-xs text-muted">
                      {[d.city, d.country].filter(Boolean).join(", ")} · {levelForXp(d.xp).name}
                    </p>
                    {s.note && <p className="mt-1 text-xs italic">{s.note}</p>}
                  </div>
                  <form action={toggleShortlist.bind(null, d.id, "/recruteurs/selection")}>
                    <button className="text-xs text-muted hover:text-primary">Retirer</button>
                  </form>
                </li>
              );
            })}
            {!shortlist?.length && <li className="text-sm text-muted">Aucun profil présélectionné.</li>}
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">Propositions envoyées · {contacts?.length ?? 0}</h2>
          {answered > 0 && <p className="text-xs text-muted">Taux d&apos;acceptation : {Math.round((accepted / answered) * 100)} %</p>}
          <ul className="mt-3 space-y-2">
            {(contacts ?? []).map((c) => {
              const d = c.dev as unknown as Dev;
              return (
                <li key={c.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{c.title}</p>
                      <p className="text-xs text-muted">
                        {d.full_name ?? d.username} · {OFFER_KIND[c.offer_kind]} · {timeAgo(c.created_at)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[c.status]}`}>{CONTACT_STATUS[c.status]}</span>
                  </div>
                  {c.decline_reason && <p className="mt-1 text-xs text-muted">« {c.decline_reason} »</p>}
                  {c.conversation_id && (
                    <Link href={`/discussions/${c.conversation_id}`} className="mt-1 inline-block text-xs text-primary">
                      Ouvrir la conversation →
                    </Link>
                  )}
                </li>
              );
            })}
            {!contacts?.length && <li className="text-sm text-muted">Aucune proposition envoyée.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
