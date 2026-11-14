import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: dispatched, error } = await createAdminClient().rpc("dispatch_topic_invitations");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dispatched });
}
