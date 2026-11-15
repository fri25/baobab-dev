import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/configured";

const safeNext = (next: unknown, fallback = "/discussions") =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;

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
  redirect(safeNext(formData.get("next"), "/fil"));
}

const DEMO = [
  { id: "aicha", name: "Aïcha", location: "Cotonou", role: "Dev Laravel" },
  { id: "koffi", name: "Koffi", location: "Abidjan", role: "Senior PHP · Expert" },
  { id: "moussa", name: "Moussa", location: "Dakar", role: "Fullstack Dev" },
  { id: "modo", name: "Modération", location: "Continent", role: "Administrateur" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const t = await getT();
  const { error, next } = await searchParams;
  const showDemo = process.env.NEXT_PUBLIC_DEMO_ACCOUNTS !== "false";

  return (
    <main className="relative flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center px-4 py-16">
      {/* Halo lumineux */}

      <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-surface/90 p-8 shadow-2xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface p-2 ring-1 ring-border/80 shadow-md">
            <Logo className="h-12 w-12" />
          </div>

          <h1 className="mt-5 text-2xl font-extrabold sm:text-3xl tracking-tight">{t("Rejoindre Baobab Dev")}</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
            {t("La plateforme d'entraide et de collaboration pour les développeurs africains.")}
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-center text-xs font-medium text-primary">
            {error}
          </div>
        )}

        {supabaseConfigured ? (
          <div className="mt-8 space-y-6">
            <form action={signInWithGithub}>
              <input type="hidden" name="next" value={next ?? ""} />
              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-3 rounded-full bg-foreground px-6 py-3.5 text-sm font-bold text-background shadow-lg transition duration-200 hover:opacity-95 hover:shadow-xl active:scale-[0.99]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>{t("Continuer avec GitHub")}</span>
              </button>
            </form>

            <div className="flex items-center gap-2 text-center text-xs text-muted">
              <span className="h-px flex-1 bg-border/60" />
              <span>{t("Profil et compétences importés en 1 clic")}</span>
              <span className="h-px flex-1 bg-border/60" />
            </div>

            {showDemo && (
              <section className="rounded-2xl border border-border/80 bg-background/50 p-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                    {t("Comptes de test (Hackathon)")}
                  </h2>
                  <span className="font-mono text-[10px] text-muted">{t("Pass : baobab2026")}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DEMO.map(({ id, name, location, role }) => (
                    <form key={id} action={signInWithPassword}>
                      <input type="hidden" name="email" value={`${id}@baobab.dev`} />
                      <input type="hidden" name="password" value="baobab2026" />
                      <input type="hidden" name="next" value={next ?? ""} />
                      <button
                        type="submit"
                        className="group flex w-full flex-col items-start rounded-xl border border-border/80 bg-surface/80 p-2.5 text-left transition duration-150 hover:border-primary/50 hover:bg-surface hover:shadow-xs"
                      >
                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                          {name}
                        </span>
                        <span className="text-[10px] text-muted truncate w-full">{role}</span>
                        <span className="text-[9px] text-primary/80 font-mono mt-0.5">@{id} · {location}</span>
                      </button>
                    </form>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-border bg-background/60 p-4 text-center text-xs text-muted">
            <p>{t("Connexion indisponible : Supabase n'est pas encore configuré (")}<code>.env.local</code>).</p>
          </div>
        )}
      </div>
    </main>
  );
}
