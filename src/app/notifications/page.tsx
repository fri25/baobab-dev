import { getT, pageTitle } from "@/lib/i18n/server";
import { toToast } from "@/lib/notifications";
import { requireSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { markAllNotificationsRead, openNotification } from "./actions";

export async function generateMetadata() {
  return { title: await pageTitle("Notifications · Baobab Dev") };
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const tr = await getT();
  const { supabase, user } = await requireSession("/notifications");
  const { error: actionError } = await searchParams;
  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select("id, kind, payload, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tr("Notifications")}</h1>
        <form action={markAllNotificationsRead}>
          <button className="text-sm text-primary">{tr("Tout marquer comme lu")}</button>
        </form>
      </div>
      {actionError && <p role="alert" className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{actionError}</p>}
      {notificationsError && <p role="alert" className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{tr("Les notifications n’ont pas pu être chargées.")}</p>}
      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
        {notificationsError ? null : notifications?.length ? (
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
                <form action={openNotification.bind(null, n.id)}>
                  <button type="submit" className="block w-full text-left hover:bg-background">
                    {content}
                  </button>
                </form>
              </li>
            );
          })
        ) : (
          <li className="px-4 py-6 text-center text-muted">{tr("Rien de neuf pour l'instant.")}</li>
        )}
      </ul>
      <p className="mt-4 text-xs text-muted">{tr("Notifications WhatsApp et email : V1, avec choix des canaux.")}</p>
    </main>
  );
}
