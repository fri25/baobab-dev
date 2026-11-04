import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importGithubProfile } from "@/lib/github";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=Code%20manquant`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, github_username")
    .eq("id", data.user.id)
    .single();

  if (profile?.github_username) {
    await importGithubProfile(supabase, data.user.id, profile.github_username);
  }
  const next = searchParams.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") && next !== "/fil" ? next : `/u/${profile?.username ?? ""}`;
  return NextResponse.redirect(`${origin}${target}`);
}
