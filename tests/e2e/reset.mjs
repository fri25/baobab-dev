// Réinitialise la base locale (migrations + seed) et attend que l'API soit de nouveau joignable.
// Kong garde parfois l'ancienne adresse du service d'authentification après le redémarrage : on le relance.
import { execSync } from "node:child_process";
import fs from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: ["ignore", "ignore", "inherit"] });
const restartKong = () => run("docker restart supabase_kong_baobab-dev");
try {
  run("npx supabase db reset");
} catch {
  // Échec typique : 502 de Kong pendant le redémarrage des services. On relance Kong et on recommence.
  console.log("Nouvelle tentative après redémarrage de Kong…");
  restartKong();
  run("npx supabase db reset");
}
restartKong();

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
for (let i = 0; i < 30; i++) {
  // Minuteur classique : celui d'AbortSignal.timeout ne retient pas le processus en vie
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      signal: controller.signal,
    });
    if (res.ok) {
      console.log("Base réinitialisée.");
      process.exit(0);
    }
  } catch {
  } finally {
    clearTimeout(timer);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.error("L'API Supabase ne répond pas après la réinitialisation.");
process.exit(1);
