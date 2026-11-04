import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/configured";

const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/fil");

async function signInWithGithub(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, scopes: "read:user" },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(data.url);
}

// Comptes de démonstration du hackathon (créés par supabase/seed.sql)
async function signInWithPassword(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirect(`/login?error=${encodeURIComponent("Email ou mot de passe incorrect")}`);
  redirect(safeNext(formData.get("next")));
}

const DEMO = [
  ["aicha", "Aïcha · Cotonou"],
  ["koffi", "Koffi · Abidjan (Expert)"],
  ["moussa", "Moussa · Dakar"],
  ["modo", "Modération"],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const showDemo = process.env.NEXT_PUBLIC_DEMO_ACCOUNTS !== "false";

  return (
    <main className="mx-auto flex max-w-sm flex-col items-center px-4 py-16 text-center">
      <Logo className="h-14 w-14" />
      <h1 className="mt-4 text-2xl font-bold">Rejoindre Baobab Dev</h1>
      <p className="mt-2 text-muted">
        Ton profil est pré-rempli avec les langages et technologies de tes dépôts GitHub publics.
      </p>

      {error && <p className="mt-6 w-full rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      {supabaseConfigured ? (
        <>
          <form action={signInWithGithub} className="mt-8 w-full">
            <input type="hidden" name="next" value={next ?? ""} />
            <button className="w-full rounded-full bg-foreground px-6 py-3 font-medium text-background hover:opacity-90">
              Continuer avec GitHub
            </button>
          </form>
          <p className="mt-3 text-xs text-muted">Google et numéro de téléphone (OTP par SMS) arrivent bientôt.</p>

          {showDemo && (
            <section className="mt-10 w-full rounded-xl border border-border bg-surface p-4 text-left">
              <h2 className="text-sm font-semibold">Comptes de démonstration</h2>
              <p className="text-xs text-muted">Mot de passe : baobab2026</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMO.map(([user, label]) => (
                  <form key={user} action={signInWithPassword}>
                    <input type="hidden" name="email" value={`${user}@baobab.dev`} />
                    <input type="hidden" name="password" value="baobab2026" />
                    <input type="hidden" name="next" value={next ?? ""} />
                    <button className="w-full rounded-lg border border-border px-2 py-2 text-xs hover:border-primary">{label}</button>
                  </form>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <p className="mt-8 w-full rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          Connexion indisponible : Supabase n&apos;est pas encore configuré (<code>.env.local</code>).
        </p>
      )}
    </main>
  );
}
