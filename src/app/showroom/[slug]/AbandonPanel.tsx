import { getT } from "@/lib/i18n/server";
import { timeAgo } from "@/lib/format";
import { adoptProject, decideAbandoned } from "../actions";
import { CheckRepoButton } from "./CheckRepoButton";

type Project = {
  id: string;
  slug: string;
  owner_id: string;
  founder_id: string | null;
  repo_url: string | null;
  abandon_status: string | null;
  last_commit_at: string | null;
  repo_stars: number | null;
  repo_forks: number | null;
  unanswered_issues: number | null;
  repo_checked_at: string | null;
  adopted_at: string | null;
};

// Détecteur de projets abandonnés (§7.3) : bandeau et choix du propriétaire, reprise par la communauté
export async function AbandonPanel({ project, userId, founderName }: { project: Project; userId: string | null; founderName: string | null }) {
  const t = await getT();
  const isOwner = userId === project.owner_id;
  const stats = (
    <p className="mt-1 text-xs text-muted">
      {project.last_commit_at && `Dernier commit ${timeAgo(project.last_commit_at)}`}
      {project.repo_stars !== null && ` · ★ ${project.repo_stars} · ${project.repo_forks} fork(s)`}
      {project.unanswered_issues !== null && ` · ${project.unanswered_issues} issue(s) sans réponse`}
    </p>
  );

  if (project.abandon_status === "detected") {
    return (
      <section className="mt-6 rounded-xl border border-gold bg-gold/5 p-4">
        <p className="font-medium">{t("Ce projet semble à l'arrêt")}</p>
        {stats}
        {isOwner ? (
          <>
            <p className="mt-2 text-sm">{t("Il a suscité de l'intérêt : que veux-tu en faire ?")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <form action={decideAbandoned.bind(null, project.id, project.slug, "relancer")}>
                <button className="w-full rounded-lg bg-leaf px-3 py-2 text-sm font-medium text-background">{t("Le relancer avec une Squad")}</button>
              </form>
              <form action={decideAbandoned.bind(null, project.id, project.slug, "ceder")}>
                <button className="w-full rounded-lg border border-primary px-3 py-2 text-sm text-primary">{t("Le céder à la communauté")}</button>
              </form>
              <form action={decideAbandoned.bind(null, project.id, project.slug, "archiver")}>
                <button className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted">{t("L'archiver")}</button>
              </form>
            </div>
            <p className="mt-2 text-xs text-muted">{t("En le cédant, tu restes crédité·e comme fondateur·rice et tu reçois le badge « Passeur de flambeau ».")}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("Son propriétaire a été prévenu et peut le relancer ou le céder.")}</p>
        )}
      </section>
    );
  }

  if (project.abandon_status === "ceded") {
    return (
      <section className="mt-6 rounded-xl border border-primary bg-primary/5 p-4">
        <p className="font-medium">{t("Projet à relancer")}</p>
        <p className="mt-1 text-sm">
          {founderName ?? t("Son fondateur")}{" "}{t("le cède à la communauté : reprends-le et donne-lui une seconde vie. Le fondateur reste crédité.")}
        </p>
        {stats}
        {userId && !isOwner && (
          <form action={adoptProject.bind(null, project.id, project.slug)} className="mt-3">
            <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink">{t("Reprendre ce projet")}</button>
          </form>
        )}
      </section>
    );
  }

  if (project.abandon_status === "archived" && isOwner) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
        <p>{t("Projet archivé.")}</p>
        <div className="mt-2 flex gap-2">
          <form action={decideAbandoned.bind(null, project.id, project.slug, "relancer")}>
            <button className="rounded-full border border-border px-3 py-1 text-xs">{t("Le relancer avec une Squad")}</button>
          </form>
          <form action={decideAbandoned.bind(null, project.id, project.slug, "ceder")}>
            <button className="rounded-full border border-border px-3 py-1 text-xs">{t("Le céder")}</button>
          </form>
        </div>
      </section>
    );
  }

  if (isOwner && project.repo_url?.startsWith("https://github.com/") && !project.abandon_status) {
    return (
      <section className="mt-6 text-xs text-muted">
        {project.repo_checked_at ? (
          <>
            {t("Activité du dépôt vérifiée")}{" "}{timeAgo(project.repo_checked_at)}
            {project.last_commit_at && ` · dernier commit ${timeAgo(project.last_commit_at)}`}.
          </>
        ) : (
          t("L'activité du dépôt est vérifiée chaque semaine.")
        )}{" "}
        <CheckRepoButton projectId={project.id} />
      </section>
    );
  }
  return null;
}
