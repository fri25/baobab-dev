import { dateLocale } from "@/lib/i18n/current";
import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Logo } from "@/components/Logo";
import { scoreColor } from "@/lib/forensic-labels";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Certificat Code Forensic ${code} · Baobab Dev` };
}

// Certificat public et vérifiable, à partager avec des investisseurs
export default async function CertificatePage({ params }: Props) {
  const t = await getT();
  const { code } = await params;
  const supabase = await createClient();
  const { data: audit } = await supabase
    .from("audits")
    .select("id, title, owner_id, score, effort_hours, closed_at, certificate_code")
    .eq("certificate_code", code.toUpperCase())
    .eq("status", "closed")
    .maybeSingle();
  if (!audit) notFound();

  const [{ data: owner }, { data: auditors }, { data: counts }] = await Promise.all([
    supabase.from("profiles").select("username, full_name").eq("id", audit.owner_id).single(),
    supabase
      .from("audit_auditors")
      .select("auditor:profiles!audit_auditors_auditor_id_fkey(username, full_name, city)")
      .eq("audit_id", audit.id),
    supabase.rpc("audit_score", { p_audit: audit.id }).single<{ critiques: number; moyens: number; mineurs: number }>(),
  ]);
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/forensic/certificat/${audit.certificate_code}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1f1a14", light: "#ffffff" } });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <article className="rounded-3xl border-2 border-border bg-surface p-8 text-center shadow-sm">
        <Logo className="mx-auto h-12 w-12" />
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted">{t("Certificat Code Forensic")}</p>
        <h1 className="mt-2 text-2xl font-bold">{audit.title}</h1>
        <p className="text-sm text-muted">{t("Porté par")}{" "}{owner?.full_name ?? owner?.username}</p>

        <p className="mt-6 font-mono text-7xl font-bold" style={{ color: scoreColor(audit.score!) }}>
          {audit.score}
          <span className="text-2xl text-muted">/100</span>
        </p>
        <p className="text-sm text-muted">{t("Score de dette technique (100 = aucune dette relevée)")}</p>

        <dl className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-2 text-sm">
          {[
            ["Critiques", counts?.critiques ?? 0],
            ["Moyens", counts?.moyens ?? 0],
            ["Mineurs", counts?.mineurs ?? 0],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl bg-background p-2">
              <dd className="font-mono text-xl font-bold">{n}</dd>
              <dt className="text-xs text-muted">{label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm">{t("Effort de correction estimé :")}{" "}{audit.effort_hours} h</p>

        <p className="mt-6 text-sm text-muted">
          {t("Audité par")}{" "}
          {(auditors ?? [])
            .map((a) => {
              const p = a.auditor as unknown as { username: string; full_name: string | null; city: string | null };
              return `${p.full_name ?? p.username}${p.city ? ` (${p.city})` : ""}`;
            })
            .join(", ")}
          {t(", auditeurs de niveau Expert, le")}{" "}{new Date(audit.closed_at!).toLocaleDateString(dateLocale(), { day: "numeric", month: "long", year: "numeric" })}.
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="w-24 rounded-lg bg-white p-1" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-left text-xs text-muted">
            {t("Vérification :")}<br />
            <span className="font-mono text-foreground">{audit.certificate_code}</span>
            <br />
            {t("baobab.dev/forensic/certificat")}
          </p>
        </div>
      </article>
    </main>
  );
}
