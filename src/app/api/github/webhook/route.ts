import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Webhook GitHub de la Micro-Bourse (§8.1) :
// - workflow_run terminé → résultat des tests d'acceptation de la PR liée
// - pull_request fusionnée → libération automatique de la prime si les tests passent

function validSignature(body: string, header: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

type Repo = { html_url: string; full_name: string };

async function findSubmission(repo: Repo, prNumber: number) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bounty_submissions")
    .select("id, status, tests_status, bounty:bounties!inner(id, tests_path, status)")
    .eq("pr_url", `${repo.html_url}/pull/${prNumber}`)
    .eq("status", "submitted")
    .maybeSingle();
  return data as unknown as { id: string; tests_status: string; bounty: { id: string; tests_path: string | null } } | null;
}

// Une PR ne peut pas modifier les tests d'acceptation
async function touchesTests(repo: Repo, prNumber: number, testsPath: string | null) {
  if (!testsPath) return false;
  const res = await fetch(`https://api.github.com/repos/${repo.full_name}/pulls/${prNumber}/files?per_page=100`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) return true; // en cas de doute, on refuse
  const files = (await res.json()) as { filename: string }[];
  return files.some((f) => f.filename === testsPath || f.filename.startsWith(`${testsPath.replace(/\/$/, "")}/`));
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }
  const event = request.headers.get("x-github-event");
  const payload = JSON.parse(raw);
  const admin = createAdminClient();

  if (event === "workflow_run" && payload.action === "completed") {
    for (const pr of payload.workflow_run.pull_requests as { number: number }[]) {
      const submission = await findSubmission(payload.repository, pr.number);
      if (!submission) continue;
      const modified = await touchesTests(payload.repository, pr.number, submission.bounty.tests_path);
      await admin.rpc("set_submission_tests", {
        p_submission_id: submission.id,
        p_passed: payload.workflow_run.conclusion === "success",
        p_tests_modified: modified,
      });
    }
  }

  if (event === "pull_request" && payload.action === "closed" && payload.pull_request.merged) {
    const submission = await findSubmission(payload.repository, payload.pull_request.number);
    if (submission?.tests_status === "passed") {
      const { error } = await admin.rpc("release_bounty", { p_submission_id: submission.id });
      if (error) console.error("Libération de la prime impossible", error);
    }
  }

  return NextResponse.json({ ok: true });
}
