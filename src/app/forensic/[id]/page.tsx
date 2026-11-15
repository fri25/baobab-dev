import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserChip } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { ReportButton } from "@/components/ReportButton";
import { getSession } from "@/lib/auth";
import { fcfa, timeAgo } from "@/lib/format";
import { AUDIT_STATUS, FINDING_CATEGORY, SEVERITY, scoreColor } from "@/lib/forensic-labels";
import { ndaClauses, ndaParties } from "@/lib/nda";
import type { AutoReport } from "@/lib/forensic";
import { addFinding, closeAudit, contestFinding, joinAudit, rateAuditor, voteFinding } from "../actions";
import { ReanalyzeButton } from "./ReanalyzeButton";

type Person = { username: string; full_name: string | null; avatar_url: string | null; city: string | null };
type Finding = {
  id: string;
  auditor_id: string | null;
  source: "auto" | "auditor";
  category: string;
  severity: keyof typeof SEVERITY;
  title: string;
  description: string;
  fix: string | null;
  file_path: string | null;
  effort_hours: number;
  status: "open" | "contested" | "upheld" | "dismissed";
  contest_reason: string | null;
  audit_votes: { auditor_id: string; uphold: boolean }[];
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const tr = await getT();
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user, profile } = await getSession();

  const { data: audit } = await supabase
    .from("audits")
    .select("id, owner_id, title, context, confidentiality, max_auditors, fee, status, deadline, score, effort_hours, certificate_code, created_at, closed_at")
    .eq("id", id)
    .maybeSingle();
  if (!audit) notFound();

  const [{ data: owner }, { data: auditors }, { data: details }, { data: findings }, { data: live }] = await Promise.all([
    supabase.from("profiles").select("username, full_name, avatar_url, city").eq("id", audit.owner_id).single<Person>(),
    supabase
      .from("audit_auditors")
      .select("auditor_id, nda_accepted_at, nda_signed_name, paid, rating, auditor:profiles!audit_auditors_auditor_id_fkey(username, full_name, avatar_url, city)")
      .eq("audit_id", id)
      .order("joined_at"),
    supabase.rpc("audit_private_details", { p_audit: id }).maybeSingle<{ repo_url: string; auto_report: AutoReport | null }>(),
    supabase
      .from("audit_findings")
      .select("id, auditor_id, source, category, severity, title, description, fix, file_path, effort_hours, status, contest_reason, audit_votes(auditor_id, uphold)")
      .eq("audit_id", id)
      .order("created_at"),
    supabase.rpc("audit_score", { p_audit: id }).single<{ score: number; effort_hours: number; critiques: number; moyens: number; mineurs: number }>(),
  ]);

  const isOwner = user?.id === audit.owner_id;
  const isAuditor = Boolean(user && auditors?.some((a) => a.auditor_id === user.id));
  const isModerator = profile && ["moderator", "admin"].includes(profile.role);
  const canSee = Boolean(details); // RLS : public, ou partie prenante
  const active = ["open", "in_progress"].includes(audit.status);
  const closed = audit.status === "closed";
  const list = (findings ?? []) as unknown as Finding[];
  const names: Record<string, string> = {};
  for (const a of auditors ?? []) {
    const p = a.auditor as unknown as Person;
    names[a.auditor_id] = p.full_name ?? p.username;
  }
  const contested = list.filter((f) => f.status === "contested").length;
  const score = closed ? audit.score! : (live?.score ?? 100);
  const order = { critique: 0, moyen: 1, mineur: 2 };
  const visible = list.filter((f) => f.status !== "dismissed").sort((a, b) => order[a.severity] - order[b.severity]);
  const dismissed = list.filter((f) => f.status === "dismissed");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/forensic" className="text-sm text-muted hover:text-primary">
        {tr("← Code Forensic")}
      </Link>
      {error && <p className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <section className="mt-3 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            {AUDIT_STATUS[audit.status]} · {audit.confidentiality === "private" ? tr("confidentiel") : tr("public")}
            {active && ` · échéance ${timeAgo(audit.deadline)}`}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{audit.title}</h1>
          <div className="mt-2 text-sm">{owner && <UserChip user={owner} detail="porteur" />}</div>
          <p className="mt-3 max-w-2xl">{audit.context}</p>
          {details?.repo_url && (
            <a href={details.repo_url} className="mt-2 inline-block break-all font-mono text-sm text-primary">
              {details.repo_url.replace("https://github.com/", "")}
            </a>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="text-xs uppercase tracking-wide text-muted">{closed ? tr("Score final") : tr("Score provisoire")}</p>
          <p className="font-mono text-5xl font-bold" style={{ color: scoreColor(score) }}>
            {score}
            <span className="text-lg text-muted">/100</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {live?.critiques ?? 0}{" "}{tr("critique ·")}{" "}{live?.moyens ?? 0}{" "}{tr("moyen ·")}{" "}{live?.mineurs ?? 0}{" "}{tr("mineur")}
          </p>
          <p className="text-xs text-muted">{tr("Effort estimé :")}{" "}{closed ? audit.effort_hours : (live?.effort_hours ?? 0)} h</p>
          {closed && audit.certificate_code && (
            <Link href={`/forensic/certificat/${audit.certificate_code}`} className="mt-3 inline-block rounded-full bg-leaf px-4 py-1.5 text-sm font-medium text-background">
              {tr("Voir le certificat")}
            </Link>
          )}
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!canSee ? (
            <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
              {tr("Audit confidentiel : le dépôt et les constats ne sont visibles que du porteur, des auditeurs (après accord de confidentialité) et de la modération.")}
              {closed && tr(" Le certificat ci-dessus résume le résultat.")}
            </p>
          ) : (
            <>
              {details?.auto_report && (
                <section className="rounded-xl border border-border bg-surface p-4 text-sm">
                  <h2 className="font-semibold">{tr("Analyse automatique")}</h2>
                  {details.auto_report.accessible ? (
                    <p className="mt-1 text-muted">
                      {details.auto_report.language ?? tr("Langage inconnu")} · {details.auto_report.files}{" "}{tr("fichiers ·")}{" "}
                      {details.auto_report.source_files}{" "}{tr("fichiers de code ·")}{" "}{details.auto_report.test_files}{" "}{tr("fichiers de test ·")}{" "}
                      {details.auto_report.dependencies_outdated}/{details.auto_report.dependencies_checked}{" "}{tr("dépendance(s) en retard")}
                    </p>
                  ) : (
                    <p className="mt-1 text-muted">{details.auto_report.note}</p>
                  )}
                  {isOwner && active && <ReanalyzeButton auditId={id} />}
                </section>
              )}

              <section>
                <h2 className="font-semibold">{tr("Constats (")}{visible.length})</h2>
                {contested > 0 && <p className="text-xs text-gold">{contested}{" "}{tr("constat(s) contesté(s) en attente du vote des auditeurs.")}</p>}
                <ul className="mt-3 space-y-3">
                  {visible.map((f) => {
                    const sev = SEVERITY[f.severity];
                    const canVote =
                      f.status === "contested" &&
                      user &&
                      ((isAuditor && f.auditor_id !== user.id) || (isModerator && !isAuditor));
                    const myVote = f.audit_votes.find((v) => v.auditor_id === user?.id);
                    return (
                      <li key={f.id} className={`rounded-xl border bg-surface p-4 ${f.status === "contested" ? "border-gold" : "border-border"}`}>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`rounded-full px-2 py-0.5 font-medium ${sev.className}`}>{sev.label}</span>
                          <span className="text-muted">{FINDING_CATEGORY[f.category]}</span>
                          <span className="text-muted">
                            · {f.source === "auto" ? tr("analyse automatique") : (names[f.auditor_id ?? ""] ?? tr("auditeur"))}
                          </span>
                          <span className="text-muted">· {f.effort_hours} h</span>
                          {f.status === "upheld" && <span className="text-leaf">{tr("· maintenu")}</span>}
                        </div>
                        <p className="mt-2 font-medium">{f.title}</p>
                        {f.file_path && <p className="font-mono text-xs text-muted">{f.file_path}</p>}
                        <div className="mt-2 text-sm">
                          <Markdown text={f.description} />
                        </div>
                        {f.fix && (
                          <p className="mt-2 rounded-lg bg-leaf/10 p-2 text-sm">
                            <strong className="text-leaf">{tr("Piste de correction :")}{" "}</strong>
                            {f.fix}
                          </p>
                        )}

                        {f.status === "contested" && (
                          <div className="mt-3 rounded-lg border border-gold/50 bg-gold/5 p-3 text-sm">
                            <p>
                              <strong>{tr("Contesté par le porteur :")}</strong> {f.contest_reason}
                            </p>
                            {canVote && !myVote && (
                              <div className="mt-2 flex gap-2">
                                <form action={voteFinding.bind(null, id, f.id, true)}>
                                  <button className="rounded-full bg-primary px-3 py-1 text-xs text-primary-ink">{tr("Maintenir le constat")}</button>
                                </form>
                                <form action={voteFinding.bind(null, id, f.id, false)}>
                                  <button className="rounded-full border border-border px-3 py-1 text-xs">{tr("Donner raison au porteur")}</button>
                                </form>
                              </div>
                            )}
                            {myVote && <p className="mt-1 text-xs text-muted">{tr("Ton vote :")}{" "}{myVote.uphold ? tr("maintenir") : tr("écarter")}.</p>}
                            {!isAuditor && !isModerator && (
                              <p className="mt-1 text-xs text-muted">{f.audit_votes.length}{" "}{tr("vote(s) des autres auditeurs.")}</p>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-2">
                            {isOwner && active && f.status === "open" && (
                              <details className="text-sm">
                                <summary className="cursor-pointer text-xs text-muted hover:text-foreground">{tr("Contester")}</summary>
                                <form action={contestFinding.bind(null, id, f.id)} className="mt-2 flex gap-2">
                                  <input name="reason" required minLength={10} placeholder={tr("Pourquoi ce constat est-il inexact ?")} className={input} />
                                  <button className="shrink-0 rounded-lg border border-border px-3 text-xs">{tr("Envoyer")}</button>
                                </form>
                              </details>
                            )}
                            {isOwner && f.status !== "contested" && details?.repo_url && (
                              <Link
                                href={`/bourse/new?titre=${encodeURIComponent(f.title)}&depot=${encodeURIComponent(details.repo_url)}&desc=${encodeURIComponent(`${f.description}\n\nPiste de correction : ${f.fix ?? ""}`)}`}
                                className="text-xs text-gold hover:underline"
                              >
                                {tr("Publier en ticket de la Micro-Bourse →")}
                              </Link>
                            )}
                          </div>
                          {user && <ReportButton targetType="audit_finding" targetId={f.id} path={`/forensic/${id}`} />}
                        </div>
                      </li>
                    );
                  })}
                  {!visible.length && <li className="text-sm text-muted">{tr("Aucun constat pour l'instant.")}</li>}
                </ul>
                {dismissed.length > 0 && (
                  <p className="mt-3 text-xs text-muted">{dismissed.length}{" "}{tr("constat(s) écarté(s) après contestation : ils ne comptent pas dans le score.")}</p>
                )}
              </section>

              {isAuditor && active && (
                <form action={addFinding.bind(null, id)} className="space-y-2 rounded-xl border border-dashed border-border p-4">
                  <h2 className="font-semibold">{tr("Ajouter un constat")}</h2>
                  <p className="text-xs text-muted">{tr("Exigeant mais constructif : décris le problème et propose toujours une piste de correction.")}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select name="severity" className={input}>
                      <option value="critique">{tr("Critique")}</option>
                      <option value="moyen">{tr("Moyen")}</option>
                      <option value="mineur">{tr("Mineur")}</option>
                    </select>
                    <select name="category" className={input}>
                      {Object.entries(FINDING_CATEGORY).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input name="title" required placeholder={tr("Titre du constat")} className={input} />
                  <textarea name="description" required rows={3} placeholder={tr("Ce qui ne va pas, et pourquoi c'est un risque")} className={input} />
                  <input name="fix" required placeholder={tr("Piste de correction")} className={input} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input name="file_path" placeholder={tr("Fichier concerné (facultatif)")} className={`${input} font-mono`} />
                    <input name="effort_hours" type="number" min={0.5} step={0.5} defaultValue={2} placeholder={tr("Effort (heures)")} className={input} />
                  </div>
                  <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">{tr("Ajouter")}</button>
                </form>
              )}
            </>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-gold bg-surface p-4 text-sm">
            <p className="text-muted">{tr("Forfait")}</p>
            <p className="font-mono text-2xl font-bold text-gold">{fcfa(audit.fee)}</p>
            <p className="text-xs text-muted">{tr("70 % partagés entre les auditeurs dont au moins un constat est maintenu.")}</p>
          </section>

          <section>
            <h2 className="font-semibold">
              {tr("Auditeurs (")}{auditors?.length ?? 0}/{audit.max_auditors})
            </h2>
            <ul className="mt-2 space-y-2">
              {auditors?.map((a) => (
                <li key={a.auditor_id} className="text-sm">
                  <UserChip user={a.auditor as unknown as Person} />
                  <p className="text-xs text-muted">
                    {tr("Accord de confidentialité signé")}{" "}{timeAgo(a.nda_accepted_at)}
                    {a.nda_signed_name && ` par ${a.nda_signed_name}`}
                    {a.paid > 0 && ` · payé ${fcfa(a.paid)}`}
                  </p>
                  {(isOwner || user?.id === a.auditor_id || isModerator) && (
                    <a
                      href={`/api/forensic/${id}/accord/${a.auditor_id}`}
                      target="_blank"
                      rel="noopener"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {tr("📄 Accord signé (PDF)")}
                    </a>
                  )}
                  {isOwner && closed && (
                    <div className="mt-1 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <form key={n} action={rateAuditor.bind(null, id, a.auditor_id, n)}>
                          <button className={`text-base ${a.rating && n <= a.rating ? "text-gold" : "text-border hover:text-gold"}`} aria-label={`Noter ${n}/5`}>
                            ★
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {user && !isOwner && !isAuditor && active && (auditors?.length ?? 0) < audit.max_auditors && (
            <form action={joinAudit.bind(null, id)} className="space-y-3 rounded-xl border border-dashed border-border p-4 text-sm">
              <h2 className="font-semibold">{tr("Devenir auditeur")}</h2>
              {(profile?.xp ?? 0) >= 2000 && profile ? (
                <>
                  <p className="text-xs text-muted">
                    {tr("Accord de confidentialité généré pour cet audit. Une fois signé, toi et le porteur recevez le PDF signé.")}
                  </p>
                  <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3 text-xs leading-relaxed" tabIndex={0}>
                    <p className="font-semibold">{tr("Accord de confidentialité – Code Forensic")}</p>
                    {ndaParties({
                      auditId: id,
                      projectTitle: audit.title,
                      repoUrl: details?.repo_url ?? "communiqué après signature",
                      ownerName: owner?.full_name ?? owner?.username ?? "Porteur",
                      ownerUsername: owner?.username ?? "?",
                      auditorName: profile.full_name ?? profile.username,
                      auditorUsername: profile.username,
                      deadline: audit.deadline,
                    }).map((t) => (
                      <p key={t}>• {t}</p>
                    ))}
                    {ndaClauses({
                      auditId: id,
                      projectTitle: audit.title,
                      repoUrl: "",
                      ownerName: "",
                      ownerUsername: "",
                      auditorName: "",
                      auditorUsername: "",
                      deadline: audit.deadline,
                    }).map((c) => (
                      <div key={c.title}>
                        <p className="font-semibold">{c.title}</p>
                        <p className="text-muted">{c.body}</p>
                      </div>
                    ))}
                  </div>
                  <label className="block text-xs font-medium">
                    {tr("Signature : ton nom complet")}
                    <input
                      name="signed_name"
                      required
                      minLength={3}
                      maxLength={120}
                      defaultValue={profile.full_name ?? ""}
                      placeholder={tr("Prénom Nom")}
                      autoComplete="name"
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-serif text-base italic"
                    />
                  </label>
                  <label className="flex items-start gap-2 text-xs">
                    <input type="checkbox" name="nda" required className="mt-0.5" />
                    <span>{tr("J'ai lu les 8 articles et je signe électroniquement cet accord de confidentialité.")}</span>
                  </label>
                  <button className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-ink">{tr("Signer l'accord et rejoindre l'audit")}</button>
                </>
              ) : (
                <p className="text-xs text-muted">{tr("Réservé aux devs de niveau Expert (2 000 XP).")}</p>
              )}
            </form>
          )}

          {(isOwner || isModerator) && audit.status === "in_progress" && (
            <form action={closeAudit.bind(null, id)} className="rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="text-xs text-muted">
                {contested > 0
                  ? tr("Attends la fin des contestations pour clôturer.")
                  : tr("Le rapport final fige le score, paie les auditeurs et génère le certificat.")}
              </p>
              <button disabled={contested > 0} className="mt-2 w-full rounded-full bg-leaf px-4 py-2 font-medium text-background disabled:opacity-40">
                {tr("Clôturer et publier le rapport")}
              </button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
