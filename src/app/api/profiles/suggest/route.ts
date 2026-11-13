import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const { supabase, user } = await getSession();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const rawQuery = new URL(request.url).searchParams.get("q") ?? "";
  const query = rawQuery.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30);
  if (query.length < 1) return NextResponse.json({ users: [] });
  const pattern = query.replace(/[\\%_]/g, "\\$&");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .ilike("username", `${pattern}%`)
    .neq("id", user.id)
    .order("username")
    .limit(8);

  if (error) {
    return NextResponse.json({ error: "Impossible de charger les suggestions." }, { status: 500 });
  }
  return NextResponse.json({ users: data ?? [] });
}
