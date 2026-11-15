import Link from "next/link";
import { levelForXp } from "@/lib/levels";

type User = { username: string; full_name?: string | null; avatar_url?: string | null; xp?: number | null };

// Palette de dégradés pour avatars initials
const AVATAR_GRADIENTS = [
  "from-amber-500 to-amber-700",
  "from-emerald-500 to-teal-700",
  "from-violet-500 to-purple-700",
  "from-cyan-500 to-blue-700",
  "from-orange-500 to-rose-700",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

// L'initiale reste visible sous la photo : en mode « données réduites », la photo n'est pas chargée.
export function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  const name = user.full_name ?? user.username;
  const initial = name.charAt(0).toUpperCase();
  const gradient = getGradient(user.username);

  return (
    <span
      className="relative inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-border/80 shadow-xs"
      style={{ width: size, height: size }}
    >
      <span
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} font-bold text-white tracking-wide`}
        style={{ fontSize: Math.max(10, size * 0.42) }}
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
          className="lite-hide absolute inset-0 h-full w-full rounded-full object-cover"
          loading="lazy"
        />
      )}
    </span>
  );
}

export function UserChip({
  user,
  detail,
  asSpan = false,
}: {
  user: User & { city?: string | null };
  detail?: string;
  asSpan?: boolean;
}) {
  const level = typeof user.xp === "number" ? levelForXp(user.xp) : null;
  const content = (
    <>
      <Avatar user={user} size={24} />
      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
        {user.full_name ?? user.username}
      </span>
      {(detail ?? user.city) && <span className="text-muted text-xs">· {detail ?? user.city}</span>}
      {level && (
        <span
          className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary"
          title={level.name}
        >
          {user.xp} XP
        </span>
      )}
    </>
  );

  const className = "group inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/70 py-1 pl-1 pr-3 text-sm transition hover:border-primary/50 hover:bg-surface";

  if (asSpan) {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link href={`/u/${user.username}`} className={className}>
      {content}
    </Link>
  );
}
