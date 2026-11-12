import { NextResponse } from "next/server";
import { checkStaleProjects } from "@/lib/abandoned";
import { collectSources } from "@/lib/radar";
import { createAdminClient } from "@/lib/supabase/admin";

// Tâche quotidienne (Vercel Cron, cf. vercel.json) :
// tickets et audits expirés, Pass Clones, API de la Stack Afrique, projets abandonnés, collecte du Radar.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  const { data: daily, error } = await admin.rpc("cron_daily");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: items } = await admin.from("stack_items").select("id, health_url").not("health_url", "is", null);
  const health = await Promise.all(
    (items ?? []).map(async (item) => {
      let up = false;
      try {
        const res = await fetch(item.health_url!, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
        up = res.status < 500;
      } catch {
        up = false;
      }
      await admin.rpc("set_stack_health", { p_item_id: item.id, p_up: up });
      return { id: item.id, up };
    }),
  );

  // Les étapes qui dépendent de services externes sont isolées : l'échec de l'une n'annule pas les autres
  const safely = <T,>(step: Promise<T>) => step.catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));
  const [projects, radar] = await Promise.all([safely(checkStaleProjects()), safely(collectSources())]);
  const [{ data: expiredOpportunities }, { data: topicsStarted }] = await Promise.all([
    admin.rpc("close_expired_opportunities"),
    admin.rpc("start_scheduled_topics"),
  ]);
  return NextResponse.json({ ...daily, health, projects, radar, expiredOpportunities, topicsStarted });
}
