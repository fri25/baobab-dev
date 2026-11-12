import { getSession } from "@/lib/auth";
import { NDA_VERSION, ndaClauses, ndaDate, ndaParties } from "@/lib/nda";
import { type PdfBlock, renderPdf } from "@/lib/pdf";
import { createAdminClient } from "@/lib/supabase/admin";

// Accord de confidentialité signé par l'auditeur, en PDF : réservé aux deux parties (et à la modération)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; auditor: string }> }) {
  const { id, auditor } = await params;
  const { user, profile } = await getSession();
  if (!user) return new Response("Connexion requise", { status: 401 });

  const admin = createAdminClient();
  const [{ data: audit }, { data: signature }] = await Promise.all([
    admin.from("audits").select("id, owner_id, title, repo_url, confidentiality, deadline, created_at").eq("id", id).maybeSingle(),
    admin
      .from("audit_auditors")
      .select("auditor_id, nda_accepted_at, nda_signed_name, nda_version, nda_hash")
      .eq("audit_id", id)
      .eq("auditor_id", auditor)
      .maybeSingle(),
  ]);
  if (!audit || !signature) return new Response("Accord introuvable", { status: 404 });
  const allowed = user.id === audit.owner_id || user.id === auditor || ["moderator", "admin"].includes(profile?.role ?? "");
  if (!allowed) return new Response("Réservé au porteur du projet et à l'auditeur", { status: 403 });

  const { data: people } = await admin.from("profiles").select("id, username, full_name").in("id", [audit.owner_id, auditor]);
  const owner = people?.find((p) => p.id === audit.owner_id);
  const auditorProfile = people?.find((p) => p.id === auditor);
  const signedName = signature.nda_signed_name ?? auditorProfile?.full_name ?? auditorProfile?.username ?? "Auditeur";
  const ctx = {
    auditId: audit.id,
    projectTitle: audit.title,
    repoUrl: audit.repo_url,
    ownerName: owner?.full_name ?? owner?.username ?? "Porteur",
    ownerUsername: owner?.username ?? "?",
    auditorName: signedName,
    auditorUsername: auditorProfile?.username ?? "?",
    deadline: audit.deadline,
  };
  const signedAt = new Date(signature.nda_accepted_at);
  const time = signedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });

  const blocks: PdfBlock[] = [
    { text: "BAOBAB DEV · CODE FORENSIC", bold: true, size: 9, color: [0.73, 0.34, 0.1] },
    { text: "Accord de confidentialité", bold: true, size: 20, gap: 6 },
    { text: `Référence ${audit.id.slice(0, 8).toUpperCase()} · version ${signature.nda_version ?? NDA_VERSION}`, size: 9, color: [0.42, 0.37, 0.31] },
    { text: "Entre les parties", bold: true, size: 12, gap: 16 },
    ...ndaParties(ctx).map((t) => ({ text: `• ${t}`, gap: 3, indent: 8 })),
    ...ndaClauses(ctx).flatMap((c) => [
      { text: c.title, bold: true, size: 11.5, gap: 12 },
      { text: c.body, gap: 2 },
    ]),
    { text: "Signatures", bold: true, size: 12, gap: 18 },
    {
      text: `L'Auditeur : signé électroniquement par ${signedName} (@${ctx.auditorUsername}) le ${ndaDate(signedAt)} à ${time} (heure de Cotonou), en saisissant son nom et en acceptant les clauses ci-dessus sur Baobab Dev.`,
      gap: 4,
    },
    {
      text: `Le Porteur : ${ctx.ownerName} (@${ctx.ownerUsername}) a soumis ces clauses en lançant l'audit ${audit.confidentiality === "private" ? "confidentiel" : "public"} le ${ndaDate(audit.created_at)}.`,
      gap: 4,
    },
    { text: "Empreinte SHA-256 de la signature", bold: true, size: 9, gap: 12 },
    { text: signature.nda_hash ?? "Signature antérieure à l'horodatage par empreinte", size: 8.5, color: [0.42, 0.37, 0.31] },
    {
      text: "Ce document est remis aux deux parties. Son authenticité peut être vérifiée auprès de Baobab Dev à partir de la référence et de l'empreinte.",
      size: 8.5,
      gap: 8,
      color: [0.42, 0.37, 0.31],
    },
  ];

  const pdf = renderPdf(blocks, { title: `Accord de confidentialité - ${audit.title}`, footer: `Baobab Dev · Accord ${audit.id.slice(0, 8).toUpperCase()}` });
  const filename = `accord-confidentialite-${audit.id.slice(0, 8)}-${ctx.auditorUsername}.pdf`;
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
