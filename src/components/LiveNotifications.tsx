"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Notification, type Toast, toToast } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

// Cloche + toasts en direct (Supabase Realtime) : badges, XP du Griot, primes…
export function LiveNotifications({ userId, unread: initialUnread }: { userId: string; unread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setUnread((u) => u + 1);
          const toast = toToast(payload.new as Notification);
          if (toast) {
            setToasts((t) => [...t, toast]);
            setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), toast.badge ? 8000 : 5000);
          }
          router.refresh(); // XP et profil à jour sans recharger
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return (
    <>
      <Link href="/notifications" className="relative rounded-full p-1.5 text-muted hover:text-foreground" aria-label="Notifications">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
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
          return t.href ? (
            <Link key={t.id} href={t.href}>
              {body}
            </Link>
          ) : (
            <div key={t.id}>{body}</div>
          );
        })}
      </div>
    </>
  );
}
