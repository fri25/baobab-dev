import "server-only";

// Code Forensic (§7.6) : premier rapport automatique sur un dépôt GitHub public.
// Sécurité (secrets commis), dépendances obsolètes (npm, Composer), duplication (fichiers identiques), tests.

export type AutoFinding = {
  category: "securite" | "dependances" | "duplication" | "tests" | "architecture" | "performance";
  severity: "critique" | "moyen" | "mineur";
  title: string;
  description: string;
  fix: string;
  file_path?: string;
  effort_hours: number;
};

export type AutoReport = {
  analyzed_at: string;
  accessible: boolean;
  language?: string | null;
  files?: number;
  source_files?: number;
  test_files?: number;
  dependencies_checked?: number;
  dependencies_outdated?: number;
  note?: string;
};

type TreeEntry = { path: string; type: "blob" | "tree"; sha: string; size?: number };

const SOURCE = /\.(js|jsx|ts|tsx|php|py|dart|java|kt|go|rb|vue|svelte|cs)$/i;
const TEST = /(^|\/)(tests?|__tests__|spec)\/|[._-](test|spec)\.[a-z]+$|Test\.(php|java|kt)$|_test\.(go|dart|py)$/i;
const SECRET = [
  { re: /(^|\/)\.env(\.(local|production|prod|dev|development))?$/i, label: "fichier .env" },
  { re: /\.(pem|key|p12|pfx|keystore|jks)$/i, label: "clé privée ou certificat" },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i, label: "clé SSH privée" },
  { re: /(^|\/)(credentials|service-?account|firebase-adminsdk[^/]*)\.json$/i, label: "identifiants de service" },
];
const VENDORED = /(^|\/)(node_modules|vendor)\//;

const gh = async (path: string) => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok ? res.json() : null;
};

const major = (v: string) => Number(v.replace(/^[^\d]*/, "").split(".")[0]);

async function latestNpm(name: string) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}/latest`, { signal: AbortSignal.timeout(5000) });
    return res.ok ? ((await res.json()) as { version: string }).version : null;
  } catch {
    return null;
  }
}

async function latestComposer(name: string) {
  try {
    const res = await fetch(`https://repo.packagist.org/p2/${name}.json`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { packages: Record<string, { version: string }[]> };
    return json.packages[name]?.find((p) => !/dev|alpha|beta|rc/i.test(p.version))?.version ?? null;
  } catch {
    return null;
  }
}

async function outdatedDependencies(
  deps: Record<string, string>,
  latest: (name: string) => Promise<string | null>,
): Promise<{ checked: number; outdated: { name: string; current: string; latest: string }[] }> {
  const entries = Object.entries(deps)
    .filter(([n, v]) => n !== "php" && !n.startsWith("ext-") && /\d/.test(v))
    .slice(0, 25);
  const results = await Promise.all(
    entries.map(async ([name, wanted]) => {
      const last = await latest(name);
      return last && major(last) > major(wanted) ? { name, current: wanted, latest: last } : null;
    }),
  );
  return { checked: entries.length, outdated: results.filter((r) => r !== null) };
}

export async function analyzeRepo(repoUrl: string): Promise<{ report: AutoReport; findings: AutoFinding[] }> {
  const analyzed_at = new Date().toISOString();
  const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) return { report: { analyzed_at, accessible: false, note: "URL de dépôt invalide." }, findings: [] };
  const [, owner, repoRaw] = match;
  const repo = repoRaw.replace(/\.git$/, "");

  const meta = (await gh(`/repos/${owner}/${repo}`)) as { default_branch: string; language: string | null } | null;
  if (!meta) {
    return {
      report: {
        analyzed_at,
        accessible: false,
        note: "Dépôt privé ou introuvable : l'analyse automatique n'a pas pu le lire. Invite les auditeurs sur GitHub.",
      },
      findings: [],
    };
  }
  const tree = (await gh(`/repos/${owner}/${repo}/git/trees/${meta.default_branch}?recursive=1`)) as { tree: TreeEntry[] } | null;
  const files = (tree?.tree ?? []).filter((e) => e.type === "blob");
  const findings: AutoFinding[] = [];

  // Sécurité : secrets commis
  for (const { re, label } of SECRET) {
    for (const f of files.filter((f) => re.test(f.path) && !/\.(example|sample|dist|template)$/i.test(f.path)).slice(0, 3)) {
      findings.push({
        category: "securite",
        severity: "critique",
        title: `Secret probablement commis : ${label}`,
        description: `Le fichier \`${f.path}\` est versionné. S'il contient des clés, elles sont exposées à toute personne ayant accès au dépôt, et restent dans l'historique git.`,
        fix: "Révoquer et régénérer les clés concernées, supprimer le fichier de l'historique (git filter-repo) et l'ajouter au .gitignore.",
        file_path: f.path,
        effort_hours: 2,
      });
    }
  }

  // Dossiers de dépendances versionnés
  const vendored = files.filter((f) => VENDORED.test(f.path));
  if (vendored.length > 0) {
    findings.push({
      category: "architecture",
      severity: "moyen",
      title: "Dépendances versionnées dans le dépôt",
      description: `${vendored.length} fichiers de \`node_modules/\` ou \`vendor/\` sont versionnés : dépôt lourd, mises à jour de sécurité impossibles à suivre.`,
      fix: "Retirer ces dossiers du dépôt, les ajouter au .gitignore et s'appuyer sur le fichier de verrouillage (package-lock.json, composer.lock).",
      effort_hours: 1,
    });
  }

  // Tests
  const own = files.filter((f) => !VENDORED.test(f.path));
  const source = own.filter((f) => SOURCE.test(f.path));
  const tests = source.filter((f) => TEST.test(f.path));
  if (source.length >= 5) {
    const ratio = tests.length / source.length;
    if (tests.length === 0) {
      findings.push({
        category: "tests",
        severity: "moyen",
        title: "Aucun test automatisé",
        description: `${source.length} fichiers de code et aucun fichier de test détecté : chaque modification peut casser une fonctionnalité sans que personne ne s'en aperçoive.`,
        fix: "Commencer par des tests sur les parcours critiques (paiement, authentification), puis les exécuter dans GitHub Actions à chaque Pull Request.",
        effort_hours: Math.min(40, Math.ceil(source.length / 4)),
      });
    } else if (ratio < 0.1) {
      findings.push({
        category: "tests",
        severity: "mineur",
        title: "Couverture de tests faible",
        description: `${tests.length} fichier(s) de test pour ${source.length} fichiers de code (${Math.round(ratio * 100)} %).`,
        fix: "Ajouter des tests sur les modules les plus modifiés et mesurer la couverture en intégration continue.",
        effort_hours: Math.min(24, Math.ceil(source.length / 8)),
      });
    }
  }

  // Duplication : fichiers de code strictement identiques
  const bySha = new Map<string, TreeEntry[]>();
  for (const f of source.filter((f) => (f.size ?? 0) > 300)) bySha.set(f.sha, [...(bySha.get(f.sha) ?? []), f]);
  const dupes = [...bySha.values()].filter((g) => g.length > 1);
  if (dupes.length > 0) {
    findings.push({
      category: "duplication",
      severity: dupes.length > 5 ? "moyen" : "mineur",
      title: `${dupes.length} fichier(s) dupliqué(s) à l'identique`,
      description: dupes
        .slice(0, 5)
        .map((g) => `- ${g.map((f) => `\`${f.path}\``).join(" = ")}`)
        .join("\n"),
      fix: "Regrouper le code commun dans un module partagé, importé là où il est utilisé.",
      effort_hours: Math.min(16, dupes.length * 1.5),
    });
  }

  // Dépendances obsolètes (version majeure de retard)
  let checked = 0;
  let outdatedCount = 0;
  const raw = async (path: string) => {
    if (!files.some((f) => f.path === path)) return null;
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${meta.default_branch}/${path}`, {
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };
  for (const [manifest, latest, label] of [
    ["package.json", latestNpm, "npm"],
    ["composer.json", latestComposer, "Composer"],
  ] as const) {
    const json = (await raw(manifest)) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; require?: Record<string, string>; "require-dev"?: Record<string, string> } | null;
    if (!json) continue;
    const deps = { ...(json.dependencies ?? json.require ?? {}), ...(json.devDependencies ?? json["require-dev"] ?? {}) };
    const { checked: n, outdated } = await outdatedDependencies(deps, latest);
    checked += n;
    outdatedCount += outdated.length;
    if (outdated.length > 0) {
      findings.push({
        category: "dependances",
        severity: outdated.length >= 3 ? "moyen" : "mineur",
        title: `${outdated.length} dépendance(s) ${label} avec une version majeure de retard`,
        description: outdated.map((o) => `- \`${o.name}\` : ${o.current} → ${o.latest}`).join("\n"),
        fix: "Mettre à jour une dépendance à la fois en lisant son guide de migration, et faire tourner les tests à chaque étape.",
        file_path: manifest,
        effort_hours: Math.min(24, outdated.length * 2),
      });
    }
  }

  return {
    report: {
      analyzed_at,
      accessible: true,
      language: meta.language,
      files: own.length,
      source_files: source.length,
      test_files: tests.length,
      dependencies_checked: checked,
      dependencies_outdated: outdatedCount,
    },
    findings,
  };
}
