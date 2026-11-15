"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Notification, type Toast, toToast } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import { openNotification } from "@/app/notifications/actions";

// Cloche + toasts en direct (Supabase Realtime) : badges, XP du Griot, primes…
export function LiveNotifications({ userId, unread: initialUnread }: { userId: string; unread: number }) {
  const tr = useT();
  const [unread, setUnread] = useState(initialUnread);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let countRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let countRequest = 0;
    let active = true;
    const refreshUnread = async () => {
      const request = ++countRequest;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      if (!active) return;
      if (error) {
        setRealtimeError("Le compteur de notifications n’a pas pu être actualisé.");
        return;
      }
      if (active && request === countRequest) {
        setUnread(count ?? 0);
        setRealtimeError(null);
      }
    };
    const scheduleUnreadRefresh = () => {
      if (countRefreshTimer) clearTimeout(countRefreshTimer);
      countRefreshTimer = setTimeout(() => {
        countRefreshTimer = null;
        void refreshUnread();
      }, 100);
    };
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const notification = payload.new as Notification & { read_at: string | null };
          scheduleUnreadRefresh();
          const toast = notification.read_at === null ? toToast(notification) : null;
          if (toast) {
            setToasts((t) => [...t, toast]);
            setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), toast.badge ? 8000 : 5000);
          }
          router.refresh(); // XP et profil à jour sans recharger
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          scheduleUnreadRefresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeError(null);
          void refreshUnread();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeError("La cloche n’est pas synchronisée en temps réel.");
        }
      });
    return () => {
      if (countRefreshTimer) clearTimeout(countRefreshTimer);
      active = false;
      countRequest++;
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  useEffect(() => {
    setUnread(initialUnread);
  }, [initialUnread]);

  return (
    <>
      <Link
        href="/notifications"
        className="relative rounded-full p-1.5 text-muted hover:text-foreground"
        aria-label={realtimeError ? tr("Notifications, synchronisation indisponible") : tr("Notifications")}
        title={realtimeError ?? tr("Notifications")}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {realtimeError && <span aria-hidden="true" className="absolute right-0 top-0 h-2 w-2 rounded-full bg-danger" />}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
      {realtimeError && <span role="status" className="sr-only">{realtimeError}</span>}
      <div
        className="fixed bottom-20 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 sm:bottom-6 sm:right-28"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const body = (
            <div
              role="status"
              className={`animate-toast-in rounded-2xl border border-l-4 bg-surface p-4 shadow-xl ring-1 ring-foreground/5 ${
                t.badge ? "border-l-gold" : "border-l-primary"
              }`}
            >
              <div className="flex items-start gap-3">
                {t.badge && <span className="text-xl" aria-hidden="true">🏅</span>}
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{t.title}</p>
                  {t.detail && <p className="mt-1 text-sm text-muted">{t.detail}</p>}
                </div>
              </div>
            </div>
          );
          return (
            <form key={t.id} action={openNotification.bind(null, t.id)}>
              <button
                type="submit"
                onClick={() => setToasts((items) => items.filter((item) => item.id !== t.id))}
                className="block w-full text-left"
              >
                {body}
              </button>
            </form>
          );
        })}
      </div>
    </>
  );
}
