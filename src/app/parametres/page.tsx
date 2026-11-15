import { getT, pageTitle } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { parseTags } from "@/lib/format";
import { OPEN_TO } from "@/lib/recruiter-labels";
import { AvatarUploader } from "./AvatarUploader";

export async function generateMetadata() {
  return { title: await pageTitle("Paramètres · Baobab Dev") };
}

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";
const GOALS = ["apprendre", "aider", "collaborer", "missions"];
const COUNTRIES = ["Bénin", "Burkina Faso", "Côte d'Ivoire", "Sénégal", "Togo", "Mali", "Niger", "Cameroun", "Ghana", "Nigeria", "Kenya", "Autre"];

async function saveProfile(formData: FormData) {
  "use server";
  const { supabase, user } = await requireSession("/parametres");
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(formData.get("full_name") || "") || null,
      bio: String(formData.get("bio") || "") || null,
      country: String(formData.get("country") || "") || null,
      city: String(formData.get("city") || "") || null,
      languages: parseTags(formData.get("languages")),
      programming_languages: parseTags(formData.get("programming_languages")),
      timezone: String(formData.get("timezone") || "Africa/Porto-Novo"),
      availability: String(formData.get("availability")),
      goals: GOALS.filter((g) => formData.get(`goal_${g}`) === "on"),
      pinned_badges: formData.getAll("pinned").map(String).slice(0, 3),
      whatsapp_number: String(formData.get("whatsapp_number") || "").replace(/[\s.-]/g, "") || null,
      whatsapp_alerts: formData.get("whatsapp_alerts") === "on",
      recruiter_visible: formData.get("recruiter_visible") === "on",
      open_to: OPEN_TO.filter((o) => formData.get(`open_${o.value}`) === "on").map((o) => o.value),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) redirect(`/parametres?error=${encodeURIComponent(error.message)}`);

  // Technologies déclarées à la main (les détectées sur GitHub sont conservées)
  const manual = parseTags(formData.get("skills"));
  await supabase.from("user_skills").delete().eq("user_id", user.id).eq("source", "manual");
  if (manual.length) {
    await supabase.from("skills").upsert(manual.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });
    const { data: skills } = await supabase.from("skills").select("id").in("name", manual);
    await supabase
      .from("user_skills")
      .upsert((skills ?? []).map((s) => ({ user_id: user.id, skill_id: s.id, source: "manual", weight: 1 })), { ignoreDuplicates: true });
  }
  revalidatePath("/", "layout");
  redirect("/parametres?ok=1");
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const t = await getT();
  const { supabase, user } = await requireSession("/parametres");
  const { error, ok } = await searchParams;
  const [{ data: p }, { data: skills }, { data: badges }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_skills").select("source, skills(name)").eq("user_id", user.id),
    supabase.from("user_badges").select("badges(code, name, tier)").eq("user_id", user.id),
  ]);
  const skillNames = (source: string) =>
    (skills ?? [])
      .filter((s) => s.source === source)
      .map((s) => (s.skills as unknown as { name: string }).name);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("Mon profil")}</h1>
      {error && <p className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {ok && <p className="mt-4 rounded-lg bg-leaf/10 p-3 text-sm text-leaf">{t("Profil enregistré.")}</p>}

      <div id="photo" className="mt-6 scroll-mt-20">
        <AvatarUploader
          user={{
            id: user.id,
            username: p.username,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            github_avatar: (user.user_metadata?.avatar_url as string | undefined) ?? null,
          }}
        />
      </div>

      <form action={saveProfile} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t("Nom affiché")}
          <input name="full_name" defaultValue={p.full_name ?? ""} className={input} />
        </label>
        <label className="block text-sm font-medium">
          {t("Bio")}
          <textarea name="bio" rows={3} defaultValue={p.bio ?? ""} className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Pays")}
            <select name="country" defaultValue={p.country ?? ""} className={input}>
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            {t("Ville")}
            <input name="city" defaultValue={p.city ?? ""} className={input} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("Langues (fr, en, wo, fon…)")}
            <input name="languages" defaultValue={p.languages.join(", ")} className={input} />
          </label>
          <label className="block text-sm font-medium">
            {t("Fuseau horaire")}
            <input name="timezone" defaultValue={p.timezone ?? ""} className={input} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t("Langages de programmation qui t’intéressent (séparés par des virgules)")}
          <input
            name="programming_languages"
            defaultValue={p.programming_languages?.join(", ") ?? ""}
            placeholder={t("JavaScript, Python, PHP, Go")}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("Disponibilité")}
          <select name="availability" defaultValue={p.availability ?? "available"} className={input}>
            <option value="available">{t("Disponible")}</option>
            <option value="limited">{t("Disponibilité limitée")}</option>
            <option value="busy">{t("Occupé·e")}</option>
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">{t("Objectifs")}</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {GOALS.map((g) => (
              <label key={g} className="flex items-center gap-1.5">
                <input type="checkbox" name={`goal_${g}`} defaultChecked={p.goals.includes(g)} /> {g}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">
          {t("Technologies déclarées (séparées par des virgules)")}
          <input name="skills" defaultValue={skillNames("manual").join(", ")} className={input} />
          {skillNames("github").length > 0 && (
            <span className="mt-1 block text-xs font-normal text-muted">{t("Détectées sur GitHub :")}{" "}{skillNames("github").join(", ")}</span>
          )}
        </label>
        {badges && badges.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium">{t("Badges épinglés (3 max.)")}</legend>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {badges.map((b) => {
                const badge = b.badges as unknown as { code: string; name: string; tier: string };
                return (
                  <label key={badge.code} className="flex items-center gap-1.5">
                    <input type="checkbox" name="pinned" value={badge.code} defaultChecked={p.pinned_badges.includes(badge.code)} />
                    {badge.name} ({badge.tier})
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <fieldset className="rounded-lg border border-border bg-surface p-3">
          <legend className="px-1 text-sm font-medium">{t("Recruteurs")}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="recruiter_visible" defaultChecked={p.recruiter_visible} />{" "}{t("Mon profil apparaît dans la recherche des recruteurs abonnés")}
          </label>
          <p className="mt-1 text-xs text-muted">
            {t("Aucun recruteur ne peut t'écrire directement : tu reçois une proposition, que tu acceptes ou déclines dans")}{" "}
            <a href="/propositions" className="text-primary">
              {t("Propositions")}
            </a>
            .
          </p>
          <p className="mt-3 text-sm">{t("Ouvert·e à")}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {OPEN_TO.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5">
                <input type="checkbox" name={`open_${o.value}`} defaultChecked={p.open_to.includes(o.value)} /> {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-border bg-surface p-3">
          <legend className="px-1 text-sm font-medium">{t("Alertes WhatsApp")}</legend>
          <label className="block text-sm">
            {t("Numéro WhatsApp (format international)")}
            <input name="whatsapp_number" defaultValue={p.whatsapp_number ?? ""} placeholder="+229 97 00 00 00" className={input} />
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="whatsapp_alerts" defaultChecked={p.whatsapp_alerts} />{" "}{t("Recevoir sur WhatsApp les opportunités du Radar qui correspondent à mon profil")}
          </label>
        </fieldset>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">{t("Enregistrer")}</button>
      </form>
    </main>
  );
}
