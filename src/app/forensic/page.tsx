import Link from "next/link";
import { getSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { AUDIT_STATUS, scoreColor } from "@/lib/forensic-labels";

export const metadata = { title: "Code Forensic · Baobab Dev" };

export default async function ForensicPage() {
  const { supabase, profile } = await getSession();
  const { data: audits } = await supabase
    .from("audits")
    .select("id, owner_id, title, context, confidentiality, max_auditors, fee, status, deadline, score, certificate_code, created_at, audit_auditors(count)")
    .order("created_at", { ascending: false })
    .limit(40);

  const mine = (audits ?? []).filter((a) => a.owner_id === profile?.id);
  const recruiting = (audits ?? []).filter((a) => a.owner_id !== profile?.id && ["open", "in_progress"].includes(a.status));
  const closed = (audits ?? []).filter((a) => a.status === "closed");
  const isExpert = (profile?.xp ?? 0) >= 2000;
  const count = (a: { audit_auditors: unknown }) => (a.audit_auditors as { count: number }[])[0]?.count ?? 0;

  type Audit = NonNullable<typeof audits>[number];
  const Card = ({ a }: { a: Audit }) => (
    <li>
      <Link href={`/forensic/${a.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-4 hover:border-primary">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{a.title}</p>
          <p className="mt-1 line-clamp-1 text-sm text-muted">{a.context}</p>
          <p className="mt-2 text-xs text-muted">
            {AUDIT_STATUS[a.status]} · {count(a)}/{a.max_auditors} auditeur(s) · {a.confidentiality === "private" ? "confidentiel" : "public"}
            {a.status !== "closed" && ` · échéance ${timeAgo(a.deadline)}`}
          </p>
        </div>
        {a.score !== null ? (
          <span className="font-mono text-2xl font-bold" style={{ color: scoreColor(a.score) }}>
            {a.score}
            <span className="text-sm text-muted">/100</span>
          </span>
        ) : (
          <span className="font-mono text-sm font-semibold text-gold">{fcfa(Math.floor((a.fee * 70) / 100))} aux auditeurs</span>
        )}
      </Link>
    </li>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Code Forensic</h1>
          <p className="max-w-2xl text-muted">
            Une arène d&apos;audit exigeante mais constructive, avant un lancement ou une levée de fonds. Analyse automatique, puis 3 à
            5 auditeurs de niveau Expert, confrontation, et un certificat à partager avec tes investisseurs.
          </p>
        </div>
        <Link href="/forensic/new" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
          Faire auditer mon code
        </Link>
      </div>

      {mine.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Mes audits</h2>
          <ul className="mt-3 space-y-3">
            {mine.map((a) => (
              <Card key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">Audits qui cherchent des auditeurs</h2>
        <p className="text-xs text-muted">
          {isExpert
            ? "Rejoins un audit, accepte l'accord de confidentialité et partage 70 % du forfait avec les autres auditeurs."
            : "Auditer est réservé aux devs de niveau Expert (2 000 XP)."}
        </p>
        <ul className="mt-3 space-y-3">
          {recruiting.map((a) => (
            <Card key={a.id} a={a} />
          ))}
          {!recruiting.length && <li className="text-sm text-muted">Aucun pour l&apos;instant.</li>}
        </ul>
      </section>

      {closed.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Rapports publiés</h2>
          <ul className="mt-3 space-y-3">
            {closed.map((a) => (
              <Card key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
