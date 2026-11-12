import Link from "next/link";
import { levelForXp } from "@/lib/levels";

type User = { username: string; full_name?: string | null; avatar_url?: string | null; xp?: number };

// L'initiale reste visible sous la photo : en mode « données réduites », la photo n'est pas chargée.
export function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  const initial = (user.full_name ?? user.username).charAt(0).toUpperCase();
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-ink"
        style={{ fontSize: size * 0.42 }}
        aria-hidden="true"
      >
        {initial}
      </span>
      {user.avatar_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar_url}
          alt=""
          width={size}
          height={size}
          className="lite-hide absolute inset-0 rounded-full"
          loading="lazy"
        />
      )}
    </span>
  );
}

export function UserChip({ user, detail }: { user: User & { city?: string | null }; detail?: string }) {
  const level = typeof user.xp === "number" ? levelForXp(user.xp) : null;
  return (
    <Link href={`/u/${user.username}`} className="inline-flex items-center gap-2 text-sm hover:text-primary">
      <Avatar user={user} size={24} />
      <span className="font-medium">{user.full_name ?? user.username}</span>
      {(detail ?? user.city) && <span className="text-muted">· {detail ?? user.city}</span>}
      {level && (
        <span className="rounded-full bg-gold/10 px-2 py-0.5 font-mono text-[10px] font-medium text-gold" title={level.name}>
          {user.xp} XP
        </span>
      )}
    </Link>
  );
}
