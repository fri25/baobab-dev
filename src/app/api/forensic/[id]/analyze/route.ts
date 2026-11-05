import { NextResponse } from "next/server";
import { analyzeRepo } from "@/lib/forensic";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Relance l'analyse automatique (après une correction, ou un dépôt rendu public). Porteur uniquement.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });

  const admin = createAdminClient();
  const { data: audit } = await admin.from("audits").select("owner_id, repo_url, status").eq("id", id).single();
  if (!audit || audit.owner_id !== auth.user.id) return NextResponse.json({ error: "Audit introuvable" }, { status: 404 });
  if (!["open", "in_progress"].includes(audit.status)) return NextResponse.json({ error: "Audit clôturé" }, { status: 400 });

  const { report, findings } = await analyzeRepo(audit.repo_url);
  // Remplace les constats automatiques non encore tranchés
  await admin.from("audit_findings").delete().eq("audit_id", id).eq("source", "auto").eq("status", "open");
  if (findings.length) await admin.from("audit_findings").insert(findings.map((f) => ({ ...f, audit_id: id, source: "auto" })));
  await admin.from("audits").update({ auto_report: report }).eq("id", id);
  return NextResponse.json({ report, findings: findings.length });
}
