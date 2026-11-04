"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const path = (id: string) => `/bourse/${id}`;
const back = (id: string, error?: { message: string } | null) => {
  if (error) redirect(`${path(id)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(path(id));
};

export async function createBounty(formData: FormData) {
  const { supabase } = await requireSession("/bourse/new");
  const { data, error } = await supabase.rpc("create_bounty", {
    p_title: String(formData.get("title")).trim(),
    p_description: String(formData.get("description")).trim(),
    p_repo_url: String(formData.get("repo_url")).trim(),
    p_acceptance_criteria: String(formData.get("acceptance_criteria")).trim(),
    p_deadline: new Date(String(formData.get("deadline"))).toISOString(),
    p_amount: Number(formData.get("amount")),
    p_tests_path: String(formData.get("tests_path") || "") || null,
    p_question_id: String(formData.get("question_id") || "") || null,
  });
  if (error) redirect(`/bourse/new?error=${encodeURIComponent(error.message)}`);
  redirect(path(data as string));
}

export async function contribute(bountyId: string, formData: FormData) {
  const { supabase } = await requireSession(path(bountyId));
  const { error } = await supabase.rpc("contribute_bounty", { p_bounty_id: bountyId, p_amount: Number(formData.get("amount")) });
  back(bountyId, error);
}

export async function reserve(bountyId: string) {
  const { supabase } = await requireSession(path(bountyId));
  const { error } = await supabase.rpc("reserve_bounty", { p_bounty_id: bountyId });
  back(bountyId, error);
}

export async function submit(bountyId: string, formData: FormData) {
  const { supabase } = await requireSession(path(bountyId));
  const prUrl = String(formData.get("pr_url")).trim();
  const prNumber = Number(prUrl.match(/\/pull\/(\d+)/)?.[1]) || null;
  const { error } = await supabase.rpc("submit_bounty", { p_bounty_id: bountyId, p_pr_url: prUrl, p_pr_number: prNumber });
  back(bountyId, error);
}

// Mode test uniquement : simule le résultat de GitHub Actions (le vrai résultat arrive par /api/github/webhook)
export async function simulateTests(bountyId: string, submissionId: string, passed: boolean) {
  const { user } = await requireSession(path(bountyId));
  const admin = createAdminClient();
  const [{ data: mode }, { data: submission }, { data: bounty }] = await Promise.all([
    admin.from("app_settings").select("value").eq("key", "payments_mode").single(),
    admin.from("bounty_submissions").select("user_id").eq("id", submissionId).single(),
    admin.from("bounties").select("creator_id").eq("id", bountyId).single(),
  ]);
  if (mode?.value !== "test") back(bountyId, { message: "Simulation désactivée en mode réel" });
  if (user.id !== submission?.user_id && user.id !== bounty?.creator_id) back(bountyId, { message: "Non autorisé" });

  const { error } = await admin.rpc("set_submission_tests", {
    p_submission_id: submissionId,
    p_passed: passed,
    p_tests_modified: false,
  });
  back(bountyId, error);
}

// Le créateur relit et fusionne : la prime est libérée instantanément
export async function mergeAndRelease(bountyId: string, submissionId: string) {
  const { supabase } = await requireSession(path(bountyId));
  const { error } = await supabase.rpc("release_bounty", { p_submission_id: submissionId });
  back(bountyId, error);
}

export async function openDispute(bountyId: string, formData: FormData) {
  const { supabase, user } = await requireSession(path(bountyId));
  const { error } = await supabase.from("disputes").insert({
    bounty_id: bountyId,
    opened_by: user.id,
    reason: String(formData.get("reason")).trim(),
  });
  back(bountyId, error);
}

export async function voteExtension(bountyId: string, formData: FormData) {
  const { supabase } = await requireSession(path(bountyId));
  const { error } = await supabase.rpc("vote_bounty_extension", { p_bounty_id: bountyId, p_days: Number(formData.get("days")) });
  back(bountyId, error);
}

export async function voteDispute(bountyId: string, disputeId: string, decision: "pay" | "refund", formData: FormData) {
  const { supabase } = await requireSession(path(bountyId));
  const { error } = await supabase.rpc("vote_dispute", {
    p_dispute_id: disputeId,
    p_decision: decision,
    p_comment: String(formData.get("comment") || "") || null,
  });
  back(bountyId, error);
}

export async function testTopup(formData: FormData) {
  const { supabase } = await requireSession("/portefeuille");
  const { error } = await supabase.rpc("test_topup", { p_amount: Number(formData.get("amount")) });
  if (error) redirect(`/portefeuille?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/portefeuille");
}
