"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { analyzeRepo } from "@/lib/forensic";
import { createAdminClient } from "@/lib/supabase/admin";

const path = (id: string) => `/forensic/${id}`;
const back = (id: string, error?: { message: string } | null) => {
  if (error) redirect(`${path(id)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path(id));
};

export async function createAudit(formData: FormData) {
  const { supabase } = await requireSession("/forensic/new");
  const repoUrl = String(formData.get("repo_url")).trim();
  const { data: id, error } = await supabase.rpc("create_audit", {
    p_title: String(formData.get("title")),
    p_repo_url: repoUrl,
    p_context: String(formData.get("context")),
    p_confidentiality: formData.get("confidentiality") === "public" ? "public" : "private",
    p_max_auditors: Number(formData.get("max_auditors")) || 3,
    p_fee: Number(formData.get("fee")),
    p_days: Number(formData.get("days")) || 14,
    p_accept_nda: formData.get("nda") === "on",
  });
  if (error) redirect(`/forensic/new?error=${encodeURIComponent(error.message)}`);

  // Premier rapport automatique (le dépôt doit être public pour être lu)
  const { report, findings } = await analyzeRepo(repoUrl);
  const admin = createAdminClient();
  await admin.from("audits").update({ auto_report: report }).eq("id", id);
  if (findings.length) {
    await admin.from("audit_findings").insert(findings.map((f) => ({ ...f, audit_id: id, source: "auto" })));
  }
  redirect(path(id as string));
}

export async function joinAudit(auditId: string, formData: FormData) {
  const { supabase } = await requireSession(path(auditId));
  const { error } = await supabase.rpc("join_audit", {
    p_audit: auditId,
    p_accept_nda: formData.get("nda") === "on",
    p_signed_name: String(formData.get("signed_name") || "").trim(),
  });
  back(auditId, error);
}

export async function addFinding(auditId: string, formData: FormData) {
  const { supabase } = await requireSession(path(auditId));
  const { error } = await supabase.rpc("add_audit_finding", {
    p_audit: auditId,
    p_category: String(formData.get("category")),
    p_severity: String(formData.get("severity")),
    p_title: String(formData.get("title")),
    p_description: String(formData.get("description")),
    p_fix: String(formData.get("fix") || ""),
    p_file: String(formData.get("file_path") || ""),
    p_effort: Number(formData.get("effort_hours")) || 1,
  });
  back(auditId, error);
}

export async function contestFinding(auditId: string, findingId: string, formData: FormData) {
  const { supabase } = await requireSession(path(auditId));
  const { error } = await supabase.rpc("contest_finding", { p_finding: findingId, p_reason: String(formData.get("reason")) });
  back(auditId, error);
}

export async function voteFinding(auditId: string, findingId: string, uphold: boolean) {
  const { supabase } = await requireSession(path(auditId));
  const { error } = await supabase.rpc("vote_finding", { p_finding: findingId, p_uphold: uphold });
  back(auditId, error);
}

export async function closeAudit(auditId: string) {
  const { supabase } = await requireSession(path(auditId));
  const { error } = await supabase.rpc("close_audit", { p_audit: auditId });
  back(auditId, error);
}

export async function rateAuditor(auditId: string, auditorId: string, rating: number) {
  const { supabase } = await requireSession(path(auditId));
  const { error } = await supabase.rpc("rate_auditor", { p_audit: auditId, p_auditor: auditorId, p_rating: rating });
  back(auditId, error);
}
