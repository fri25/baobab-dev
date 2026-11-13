import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { startDirect, toggleBlock } from "@/app/discussions/actions";
import { BadgeChip } from "@/components/BadgeChip";
import { ActivityHeatmap, ActivityList } from "@/components/GithubActivity";
import { githubActivity } from "@/lib/github-activity";
import QRCode from "qrcode";
import { XP_REASONS } from "@/lib/labels";
import { levelForXp } from "@/lib/levels";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { XP_METHODS } from "@/lib/xp-rewards";

const AVAILABILITY = {
  available: { label: "Disponible", color: "var(--leaf)" },
  limited: { label: "Disponibilité limitée", color: "var(--gold)" },
  busy: { label: "Occupé·e", color: "var(--muted)" },
};

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username} · Baobab Dev` };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(decodeURIComponent(username));
  if (!profile) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const isOwner = auth.user?.id === profile.id;
  const { data: block } =
    auth.user && !isOwner
      ? await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", auth.user.id).eq("blocked_id", profile.id).maybeSingle()
      : { data: null };

  const { data: clone } = await supabase
    .from("ai_clones")
    .select("id, name, specialty")
    .eq("owner_id", profile.id)
    .eq("status", "published")
    .maybeSingle();
  const { data: evidence } = await supabase.rpc("talent_evidence", { p_user: profile.id });
  const verified = (evidence as { verified?: boolean } | null)?.verified === true;
  const activities = profile.github_username ? await githubActivity(profile.github_username, 30) : [];
  const lvl = levelForXp(profile.xp);
  const pinned = profile.pinned_badges
    .map((code) => profile.badges.find((b) => b.code === code))
    .filter((b) => b !== undefined)
    .slice(0, 3);
  const shownPinned = pinned.length > 0 ? pinned : profile.badges.slice(0, 3);
  const maxWeight = Math.max(1, ...profile.skills.map((s) => s.weight));
  const availability = profile.availability ? AVAILABILITY[profile.availability] : null;
  const xpByReason = new Map(profile.xpBreakdown.map((entry) => [entry.reason, entry.amount]));
  const knownXpReasons = new Set<string>(XP_METHODS.map((method) => method.reason));
  const xpEntries = [
    ...XP_METHODS.map((method) => ({
      reason: method.reason,
      label: method.label,
      description: method.description,
      requiredXp: "requiredXp" in method ? method.requiredXp : 0,
      href: method.href,
      amount: xpByReason.get(method.reason) ?? 0,
    })),
    ...profile.xpBreakdown
      .filter((entry) => !knownXpReasons.has(entry.reason))
      .map((entry) => ({
        reason: entry.reason,
        label: XP_REASONS[entry.reason] ?? entry.reason,
        description: "Autre source de points enregistrée sur ce profil.",
        requiredXp: 0,
        href: "/questions",
        amount: entry.amount,
      })),
  ].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, "fr"));
  const xpCategoryTotal = xpEntries.reduce((total, entry) => total + entry.amount, 0);
  const profileUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/u/${profile.username}`;
  const shareText = `Mon profil Baobab Dev : ${lvl.name}, ${profile.xp} XP. ${profileUrl}`;
  const qr = await QRCode.toString(profileUrl, { type: "svg", margin: 1, color: { dark: "#1f1a14", light: "#ffffff" } });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* En-tête */}
      <section className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="h-24 w-24 rounded-full border border-border" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-ink">
            {(profile.full_name ?? profile.username).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {profile.full_name ?? profile.username}
            {verified && (
              <span
                className="rounded-full bg-leaf/15 px-2 py-0.5 text-xs font-medium text-leaf"
                title="GitHub relié et au moins deux autres preuves d'activité (réponses acceptées, Squads, primes, défis, audits, projets)"
              >
                ✓ Profil vérifié
              </span>
            )}
          </h1>
          <p className="text-muted">
            @{profile.username}
            {(profile.city || profile.country) && <> · {[profile.city, profile.country].filter(Boolean).join(", ")}</>}
          </p>
          {profile.bio && <p className="mt-3 max-w-2xl">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {availability && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: availability.color }} />
                {availability.label}
              </span>
            )}
            {profile.languages.length > 0 && (
              <span className="text-muted">Langues : {profile.languages.join(", ")}</span>
            )}
            {profile.programming_languages.length > 0 ? (
              <span className="text-muted">Langages de programmation : {profile.programming_languages.join(", ")}</span>
            ) : isOwner ? (
              <Link href="/parametres" className="text-primary hover:underline">
                Ajouter tes langages de programmation
              </Link>
            ) : null}
            {profile.github_username && (
              <a href={`https://github.com/${profile.github_username}`} className="text-primary hover:underline">
                github.com/{profile.github_username}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col">
          {auth.user && !isOwner && (
            <form action={startDirect.bind(null, profile.id)}>
              <button className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">
                Envoyer un message
              </button>
            </form>
          )}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            className="rounded-full border border-border px-4 py-2 text-center text-sm hover:bg-surface"
          >
            Partager sur WhatsApp
          </a>
          <details className="text-center text-sm">
            <summary className="cursor-pointer rounded-full border border-border px-4 py-2 hover:bg-surface">QR code</summary>
            <div className="mt-2 w-32 rounded-lg bg-white p-1" dangerouslySetInnerHTML={{ __html: qr }} />
          </details>
          {auth.user && !isOwner && (
            <form action={toggleBlock.bind(null, profile.id, profile.username)}>
              <button className="w-full px-4 py-1 text-xs text-muted hover:text-primary">
                {block ? "Débloquer" : "Bloquer les messages"}
              </button>
            </form>
          )}
          {isOwner && (
            <Link href="/parametres" className="rounded-full border border-border px-4 py-2 text-center text-sm hover:bg-surface">
              Modifier
            </Link>
          )}
          {isOwner && (
            <form action="/auth/signout" method="post">
              <button className="w-full rounded-full border border-border px-4 py-2 text-center text-sm hover:bg-surface">
                Se déconnecter
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Niveau et progression */}
      <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p>
            <span className="text-sm text-muted">Niveau {lvl.level}</span>{" "}
            <span className="text-xl font-bold">{lvl.name}</span>
          </p>
          <p className="font-mono text-lg font-semibold text-primary">{profile.xp.toLocaleString("fr-FR")} XP</p>
        </div>
        <div
          className="mt-3 h-3 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={Math.round(lvl.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {lvl.next
            ? `Encore ${(lvl.next.floor - profile.xp).toLocaleString("fr-FR")} XP pour devenir ${lvl.next.name}`
            : "Niveau maximal atteint"}
          {lvl.level < 5 && " · le clone IA se débloque au niveau Expert"}
        </p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Badges épinglés */}
          <section>
            <h2 className="mb-3 font-semibold">Badges épinglés</h2>
            {shownPinned.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {shownPinned.map((b) => (
                  <BadgeChip key={b.code} badge={b} large />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Pas encore de badge. Réponds à une question pour décrocher « Sage du Village ».</p>
            )}
            {profile.badges.length > shownPinned.length && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-primary">
                  Tous les badges ({profile.badges.length})
                </summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {profile.badges.map((b) => (
                    <BadgeChip key={b.code} badge={b} />
                  ))}
                </div>
              </details>
            )}
          </section>

          {clone && (
            <Link href={`/clones/${clone.id}`} className="block rounded-xl border border-primary bg-surface p-4 hover:bg-background">
              <span className="text-xs font-medium uppercase tracking-wide text-primary">🤖 Clone IA</span>
              <span className="mt-1 block font-semibold">{clone.name}</span>
              <span className="block text-sm text-muted">{clone.specialty} · première question gratuite</span>
            </Link>
          )}

          {/* GitHub vivant */}
          {profile.github_username && (
            <section>
              <h2 className="mb-3 font-semibold">Activité GitHub</h2>
              <ActivityHeatmap activities={activities} />
              <div className="mt-3">
                <ActivityList activities={activities.slice(0, 6)} canConvert={isOwner} />
              </div>
            </section>
          )}

          {/* Projets */}
          <section>
            <h2 className="mb-3 font-semibold">Projets</h2>
            {profile.projects.length > 0 ? (
              <ul className="space-y-3">
                {profile.projects.map((p) => (
                  <li key={p.slug} className="rounded-xl border border-border bg-surface p-4">
                    <Link href={`/showroom/${p.slug}`} className="font-medium hover:text-primary">
                      {p.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted">{p.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.stack.map((s) => (
                        <span key={s} className="rounded bg-background px-2 py-0.5 font-mono text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aucun projet publié dans le Showroom.</p>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          {/* Technologies */}
          <section>
            <h2 className="mb-3 font-semibold">Technologies</h2>
            {profile.skills.length > 0 ? (
              <ul className="space-y-2">
                {profile.skills.map((s) => (
                  <li key={s.name} className="text-sm">
                    <div className="flex justify-between">
                      <span>{s.name}</span>
                      <span className="text-xs text-muted">
                        {s.source === "github" ? `${s.weight} dépôt${s.weight > 1 ? "s" : ""}` : "déclaré"}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(8, (s.weight / maxWeight) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aucune technologie détectée.</p>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">XP par catégorie</h2>
              <span className="font-mono text-sm font-semibold text-primary">
                {xpCategoryTotal.toLocaleString("fr-FR")} XP au total
              </span>
            </div>
            {xpCategoryTotal !== profile.xp && (
              <p role="alert" className="mt-2 rounded-lg bg-primary/10 p-3 text-xs text-primary">
                Le détail des catégories ne correspond pas au solde du profil. Actualise la page ou contacte l’équipe.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {xpEntries.map((entry) => {
                const locked = entry.requiredXp > profile.xp;
                const content = (
                  <div className="flex items-start gap-3 p-3">
                    <span className={`min-w-16 font-mono text-sm font-bold ${entry.amount > 0 ? "text-leaf" : entry.amount < 0 ? "text-primary" : "text-muted"}`}>
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount.toLocaleString("fr-FR")} XP
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {entry.label}
                        {locked && (
                          <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] text-muted">
                            Verrouillé · niveau Expert
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-muted">{entry.description}</span>
                      {locked && (
                        <span className="mt-1 block text-xs text-muted">
                          Débloqué à {entry.requiredXp.toLocaleString("fr-FR")} XP.
                        </span>
                      )}
                    </span>
                  </div>
                );

                return (
                  <li
                    key={entry.reason}
                    className={`rounded-xl border border-border bg-surface ${locked ? "opacity-50 grayscale" : "transition hover:border-primary/40 hover:bg-background"}`}
                  >
                    {locked ? <div aria-disabled="true">{content}</div> : <Link href={entry.href}>{content}</Link>}
                  </li>
                );
              })}
            </ul>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-primary">Activité XP récente</summary>
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
                {profile.activity.length > 0 ? (
                  profile.activity.map((a, i) => (
                    <li key={`${a.created_at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span>
                        {XP_REASONS[a.reason] ?? a.reason}
                        <span className="block text-xs text-muted">
                          {new Date(a.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      </span>
                      <span className={`font-mono font-semibold ${a.amount >= 0 ? "text-leaf" : "text-primary"}`}>
                        {a.amount >= 0 ? "+" : ""}
                        {a.amount}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-3 text-sm text-muted">Aucune activité pour l&apos;instant.</li>
                )}
              </ul>
            </details>
          </section>
        </aside>
      </div>
    </main>
  );
}
