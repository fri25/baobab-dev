import Link from "next/link";
import { revalidatePath } from "next/cache";
import { toToast } from "@/lib/notifications";
import { requireSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Notifications · Baobab Dev" };

async function markAllRead() {
  "use server";
  const { supabase, user } = await requireSession("/notifications");
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const { supabase, user } = await requireSession("/notifications");
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, kind, payload, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <form action={markAllRead}>
          <button className="text-sm text-primary">Tout marquer comme lu</button>
        </form>
      </div>
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
        {notifications?.length ? (
          notifications.map((n) => {
            const t = toToast(n as never);
            if (!t) return null;
            const content = (
              <div className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t.badge && "🏅 "}
                    {t.title}
                  </p>
                  {t.detail && <p className="truncate text-sm text-muted">{t.detail}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
              </div>
            );
            return (
              <li key={n.id}>
                {t.href ? (
                  <Link href={t.href} className="block hover:bg-background">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })
        ) : (
          <li className="px-4 py-6 text-center text-muted">Rien de neuf pour l&apos;instant.</li>
        )}
      </ul>
      <p className="mt-4 text-xs text-muted">Notifications WhatsApp et email : V1, avec choix des canaux.</p>
    </main>
  );
}
