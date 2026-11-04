import { ActivityList } from "@/components/GithubActivity";
import { githubActivity } from "@/lib/github-activity";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "GitHub vivant · Baobab Dev" };

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: devs } = await supabase
    .from("profiles")
    .select("github_username")
    .not("github_username", "is", null)
    .order("updated_at", { ascending: false })
    .limit(15);

  const all = (await Promise.all((devs ?? []).map((d) => githubActivity(d.github_username!, 5)))).flat();
  all.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">GitHub vivant</h1>
      <p className="mt-1 text-muted">
        Le travail de la communauté, au fil des commits, Pull Requests, issues et versions publiés sur GitHub.
      </p>
      <div className="mt-6">
        <ActivityList activities={all.slice(0, 40)} showLogin />
      </div>
      {!devs?.length && (
        <p className="mt-4 text-sm text-muted">Les devs connectés avec GitHub apparaîtront ici.</p>
      )}
    </main>
  );
}
