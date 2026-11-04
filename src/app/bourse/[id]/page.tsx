import Link from "next/link";
import { notFound } from "next/navigation";
import { UserChip } from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { BOUNTY_STATUS } from "@/lib/labels";
import {
  contribute,
  mergeAndRelease,
  openDispute,
  reserve,
  simulateTests,
  submit,
  voteDispute,
  voteExtension,
} from "../actions";

type Person = { username: string; full_name: string | null; avatar_url: string | null; city: string | null };

const TESTS = {
  pending: { label: "Tests en attente", className: "text-muted" },
  passed: { label: "Tests passés ✓", className: "text-leaf" },
  failed: { label: "Tests échoués ✗", className: "text-primary" },
};

export default async function BountyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await getSession();

  const { data: bounty } = await supabase
    .from("bounties")
    .select("*, creator:profiles!bounties_creator_id_fkey(username, full_name, avatar_url, city), reserved:profiles!bounties_reserved_by_fkey(username, full_name, avatar_url, city), winner:profiles!bounties_winner_id_fkey(username, full_name, avatar_url, city)")
    .eq("id", id)
    .maybeSingle();
  if (!bounty) notFound();

  const [{ data: escrow }, { data: contributions }, { data: submissions }, { data: mode }, { data: wallet }] = await Promise.all([
    supabase.from("escrows").select("amount, status").eq("bounty_id", id).single(),
    supabase
      .from("bounty_contributions")
      .select("id, amount, created_at, user_id, contributor:profiles!bounty_contributions_user_id_fkey(username, full_name, avatar_url, city)")
      .eq("bounty_id", id)
      .order("created_at"),
    supabase
      .from("bounty_submissions")
      .select("id, pr_url, tests_status, tests_modified, status, created_at, user_id, author:profiles!bounty_submissions_user_id_fkey(username, full_name, avatar_url, city)")
      .eq("bounty_id", id)
      .order("created_at"),
    supabase.from("app_settings").select("value").eq("key", "payments_mode").single(),
    user ? supabase.from("wallets").select("balance").eq("user_id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const [{ data: disputes }, { data: extensionVotes }, { data: viewer }] = await Promise.all([
    supabase
      .from("disputes")
      .select("id, reason, status, decision, arbiters, opened_by, created_at, dispute_votes(arbiter_id, decision)")
      .eq("bounty_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("bounty_extension_votes").select("user_id, days").eq("bounty_id", id),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  const openDisputeRow = disputes?.find((d) => d.status === "open");
  const isModerator = ["moderator", "admin"].includes(viewer?.role ?? "");
  const isArbiter = Boolean(user && openDisputeRow?.arbiters.includes(user.id));
  const myVote = (openDisputeRow?.dispute_votes as { arbiter_id: string; decision: string }[] | undefined)?.find(
    (v) => v.arbiter_id === user?.id,
  );
  const isContributor = Boolean(user && contributions?.some((c) => c.user_id === user.id));

  const status = BOUNTY_STATUS[bounty.status];
  const isCreator = user?.id === bounty.creator_id;
  const isOpen = ["open", "reserved", "in_review"].includes(bounty.status);
  const reservedByOther =
    bounty.status === "reserved" && bounty.reserved_by !== user?.id && new Date(bounty.reserved_until) > new Date();
  const testMode = mode?.value === "test";
  const commission = Math.floor(bounty.total_amount * 0.1);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/bourse" className="text-sm text-muted hover:text-primary">
        ← Micro-Bourse
      </Link>
      {testMode && (
        <p className="mt-3 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs text-gold">
          Mode test : aucun argent réel n&apos;est engagé.
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <div className="mt-4 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: status.color }} />
            <span>{status.label}</span>
            <span className="text-muted">· échéance {timeAgo(bounty.deadline)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold">{bounty.title}</h1>
          <div className="mt-2 text-sm">
            <UserChip user={bounty.creator} />
          </div>
          <p className="mt-6 whitespace-pre-line">{bounty.description}</p>

          <section className="mt-6 rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">Critères d&apos;acceptation</h2>
            <p className="mt-2 whitespace-pre-line text-sm">{bounty.acceptance_criteria}</p>
            <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Dépôt</dt>
                <dd>
                  <a href={bounty.repo_url} className="break-all text-primary">
                    {bounty.repo_url.replace("https://github.com/", "")}
                  </a>
                </dd>
              </div>
              {bounty.tests_path && (
                <div>
                  <dt className="text-muted">Tests verrouillés</dt>
                  <dd className="font-mono text-xs">{bounty.tests_path}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Pull Requests soumises */}
          <section className="mt-8">
            <h2 className="font-semibold">Pull Requests ({submissions?.length ?? 0})</h2>
            <ul className="mt-3 space-y-3">
              {submissions?.map((s) => {
                const tests = TESTS[s.tests_status as keyof typeof TESTS];
                const canSimulate = testMode && isOpen && s.status === "submitted" && (user?.id === s.user_id || isCreator);
                return (
                  <li key={s.id} className={`rounded-xl border bg-surface p-4 ${s.status === "accepted" ? "border-leaf" : "border-border"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <UserChip user={s.author as unknown as Person} />
                      <span className={`text-sm font-medium ${tests.className}`}>{tests.label}</span>
                    </div>
                    <a href={s.pr_url} className="mt-2 block break-all font-mono text-xs text-primary">
                      {s.pr_url}
                    </a>
                    {s.tests_modified && <p className="mt-1 text-xs text-primary">Rejetée : la PR modifie les tests d&apos;acceptation.</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canSimulate && s.tests_status !== "passed" && (
                        <>
                          <form action={simulateTests.bind(null, id, s.id, true)}>
                            <button className="rounded-full border border-leaf px-3 py-1 text-xs text-leaf">Simuler : tests OK</button>
                          </form>
                          <form action={simulateTests.bind(null, id, s.id, false)}>
                            <button className="rounded-full border border-border px-3 py-1 text-xs text-muted">Simuler : échec</button>
                          </form>
                        </>
                      )}
                      {isCreator && isOpen && s.tests_status === "passed" && s.status === "submitted" && (
                        <form action={mergeAndRelease.bind(null, id, s.id)}>
                          <button className="rounded-full bg-leaf px-4 py-1.5 text-sm font-medium text-background">
                            Fusionner et libérer {fcfa(bounty.total_amount - commission)}
                          </button>
                        </form>
                      )}
                      {s.status === "accepted" && <span className="text-sm font-medium text-leaf">Prime versée</span>}
                    </div>
                  </li>
                );
              })}
            </ul>

            {user && !isCreator && isOpen && !reservedByOther && (
              <div className="mt-4 space-y-3 rounded-xl border border-dashed border-border p-4">
                {bounty.status === "open" && (
                  <form action={reserve.bind(null, id)}>
                    <button className="rounded-full border border-border px-4 py-1.5 text-sm">Réserver 48 h pour travailler dessus</button>
                  </form>
                )}
                {bounty.status === "reserved" && bounty.reserved_by === user.id && (
                  <p className="text-sm text-gold">Réservé pour toi jusqu&apos;au {new Date(bounty.reserved_until).toLocaleString("fr-FR")}.</p>
                )}
                <form action={submit.bind(null, id)} className="flex flex-wrap gap-2">
                  <input
                    name="pr_url"
                    type="url"
                    required
                    pattern="https://github\.com/.+/pull/\d+"
                    placeholder="https://github.com/…/pull/42"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
                  />
                  <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-ink">Soumettre ma PR</button>
                </form>
              </div>
            )}
            {reservedByOther && bounty.reserved && (
              <p className="mt-4 text-sm text-muted">
                Réservé par <UserChip user={bounty.reserved} /> jusqu&apos;au {new Date(bounty.reserved_until).toLocaleString("fr-FR")}.
              </p>
            )}
          </section>
        </div>

        {/* Séquestre */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-gold bg-surface p-5">
            <p className="text-sm text-muted">Prime en séquestre</p>
            <p className="mt-1 font-mono text-3xl font-bold text-gold">{fcfa(bounty.total_amount)}</p>
            <p className="mt-1 text-xs text-muted">
              {escrow?.status === "released"
                ? "Libérée au résolveur"
                : `Le résolveur reçoit ${fcfa(bounty.total_amount - commission)} (10 % de commission).`}
            </p>
            {bounty.winner && (
              <div className="mt-4 rounded-lg bg-leaf/10 p-3 text-sm">
                <p className="text-leaf">Résolu par</p>
                <UserChip user={bounty.winner} />
              </div>
            )}
            {user && isOpen && (
              <form action={contribute.bind(null, id)} className="mt-4 space-y-2">
                <label className="block text-sm font-medium">
                  Même besoin ? Abonde la cagnotte
                  <div className="mt-1 flex gap-2">
                    <input
                      name="amount"
                      type="number"
                      min={500}
                      step={500}
                      defaultValue={5000}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2"
                    />
                    <button className="rounded-lg bg-gold px-4 text-sm font-medium text-background">Abonder</button>
                  </div>
                </label>
                <p className="text-xs text-muted">
                  Solde : {fcfa(wallet?.balance ?? 0)} ·{" "}
                  <Link href="/portefeuille" className="text-primary">
                    recharger
                  </Link>
                </p>
              </form>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Contributeurs</h2>
            <ul className="space-y-2">
              {contributions?.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <UserChip user={c.contributor as unknown as Person} detail="" />
                  <span className="font-mono">{fcfa(c.amount)}</span>
                </li>
              ))}
            </ul>
          </section>

          {isContributor && isOpen && (
            <form action={voteExtension.bind(null, id)} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <p className="font-medium">Prolonger le ticket ?</p>
              <p className="text-xs text-muted">
                Vote pondéré par les montants : prolongé dès que plus de la moitié des fonds vote oui.
                {extensionVotes?.length ? ` ${extensionVotes.length} vote(s) en cours.` : ""}
              </p>
              <div className="mt-2 flex gap-2">
                <select name="days" className="rounded-lg border border-border bg-background px-2 text-sm">
                  <option value="7">+7 jours</option>
                  <option value="14">+14 jours</option>
                  <option value="30">+30 jours</option>
                </select>
                <button className="rounded-lg border border-border px-3 py-1">Voter</button>
              </div>
            </form>
          )}

          {openDisputeRow && (
            <section className="rounded-xl border border-primary bg-primary/5 p-3 text-sm">
              <p className="font-medium text-primary">Litige en cours</p>
              <p className="mt-1">{openDisputeRow.reason}</p>
              <p className="mt-1 text-xs text-muted">
                {openDisputeRow.arbiters.length} arbitre(s) tiré(s) au sort ·{" "}
                {(openDisputeRow.dispute_votes as unknown[]).length} vote(s) · décision sous 5 jours
              </p>
              {(isArbiter || isModerator) && !myVote && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium">{isArbiter ? "Tu es arbitre :" : "Décision de la modération :"}</p>
                  <div className="flex gap-2">
                    <form action={voteDispute.bind(null, id, openDisputeRow.id, "pay")}>
                      <button className="rounded-full bg-leaf px-3 py-1 text-xs text-background">Payer la PR</button>
                    </form>
                    <form action={voteDispute.bind(null, id, openDisputeRow.id, "refund")}>
                      <button className="rounded-full border border-border px-3 py-1 text-xs">Rembourser</button>
                    </form>
                  </div>
                </div>
              )}
              {myVote && <p className="mt-2 text-xs text-muted">Ton vote : {myVote.decision === "pay" ? "payer" : "rembourser"}.</p>}
            </section>
          )}
          {disputes
            ?.filter((d) => d.status === "resolved")
            .map((d) => (
              <p key={d.id} className="text-xs text-muted">
                Litige tranché : {d.decision === "pay" ? "prime versée" : "contributeurs remboursés"}.
              </p>
            ))}

          {user && (isCreator || submissions?.some((s) => s.user_id === user.id)) && isOpen && !openDisputeRow && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Ouvrir un litige</summary>
              <form action={openDispute.bind(null, id)} className="mt-2 space-y-2">
                <textarea name="reason" required rows={3} className="w-full rounded-lg border border-border bg-surface p-2" />
                <button className="rounded-lg border border-primary px-3 py-1 text-primary">Envoyer aux arbitres</button>
                <p className="text-xs text-muted">Arbitrage par 3 seniors tirés au sort, décision sous 5 jours.</p>
              </form>
            </details>
          )}
        </aside>
      </div>
    </main>
  );
}
