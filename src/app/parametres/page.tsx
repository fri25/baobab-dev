import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProfilePhotoInput } from "@/components/ProfilePhotoInput";
import { requireSession } from "@/lib/auth";
import { parseTags } from "@/lib/format";
import {
  isValidProfileAvatar,
  MAX_PROFILE_AVATAR_SIZE,
  ownProfileAvatarPath,
  PROFILE_AVATAR_TYPES,
  PROFILE_AVATARS_BUCKET,
} from "@/lib/profile-avatars";
import { OPEN_TO } from "@/lib/recruiter-labels";

export const metadata = { title: "Paramètres · Baobab Dev" };

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";
const GOALS = ["apprendre", "aider", "collaborer", "missions"];
const COUNTRIES = ["Bénin", "Burkina Faso", "Côte d'Ivoire", "Sénégal", "Togo", "Mali", "Niger", "Cameroun", "Ghana", "Nigeria", "Kenya", "Autre"];

async function saveProfile(formData: FormData) {
  "use server";
  const { supabase, user } = await requireSession("/parametres");
  const { data: current, error: currentError } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
  if (currentError) redirect(`/parametres?error=${encodeURIComponent(currentError.message)}`);

  const avatarEntry = formData.get("avatar");
  const avatarFile = avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;
  let avatarUrl = current.avatar_url;
  let uploadedAvatarPath: string | null = null;

  if (avatarFile) {
    const extension = Object.entries(PROFILE_AVATAR_TYPES).find(([type]) => type === avatarFile.type)?.[1];
    if (!extension || avatarFile.size > MAX_PROFILE_AVATAR_SIZE || !(await isValidProfileAvatar(avatarFile, avatarFile.type))) {
      redirect(`/parametres?error=${encodeURIComponent("Choisis une image JPEG, PNG ou WebP de 3 Mo maximum.")}`);
    }

    uploadedAvatarPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_AVATARS_BUCKET)
      .upload(uploadedAvatarPath, avatarFile, { contentType: avatarFile.type, cacheControl: "31536000" });
    if (uploadError) redirect(`/parametres?error=${encodeURIComponent(uploadError.message)}`);
    avatarUrl = supabase.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(uploadedAvatarPath).data.publicUrl;
  } else if (formData.get("remove_avatar") === "on") {
    avatarUrl = null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      full_name: String(formData.get("full_name") || "") || null,
      bio: String(formData.get("bio") || "") || null,
      country: String(formData.get("country") || "") || null,
      city: String(formData.get("city") || "") || null,
      languages: parseTags(formData.get("languages")),
      timezone: String(formData.get("timezone") || "Africa/Porto-Novo"),
      availability: String(formData.get("availability")),
      goals: GOALS.filter((g) => formData.get(`goal_${g}`) === "on"),
      pinned_badges: formData.getAll("pinned").map(String).slice(0, 3),
      whatsapp_number: String(formData.get("whatsapp_number") || "").replace(/[\s.-]/g, "") || null,
      whatsapp_alerts: formData.get("whatsapp_alerts") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    const cleanupError = uploadedAvatarPath
      ? (await supabase.storage.from(PROFILE_AVATARS_BUCKET).remove([uploadedAvatarPath])).error
      : null;
    const message = cleanupError ? `${error.message} La nouvelle photo n'a pas pu être supprimée.` : error.message;
    redirect(`/parametres?error=${encodeURIComponent(message)}`);
  }

  const { error: programmingLanguagesError } = await supabase
    .from("profiles")
    .update({ programming_languages: parseTags(formData.get("programming_languages")) })
    .eq("id", user.id);

  // Les préférences recruteurs ont leur propre migration. Les isoler évite
  // qu'une ancienne base bloque l'enregistrement d'une photo ou du profil.
  const { error: recruiterPreferencesError } = await supabase
    .from("profiles")
    .update({
      recruiter_visible: formData.get("recruiter_visible") === "on",
      open_to: OPEN_TO.filter((o) => formData.get(`open_${o.value}`) === "on").map((o) => o.value),
    })
    .eq("id", user.id);

  let photoCleanupWarning = false;
  const oldAvatarPath = ownProfileAvatarPath(current.avatar_url, user.id);
  if (oldAvatarPath && oldAvatarPath !== uploadedAvatarPath && oldAvatarPath !== ownProfileAvatarPath(avatarUrl, user.id)) {
    const { error: removeError } = await supabase.storage.from(PROFILE_AVATARS_BUCKET).remove([oldAvatarPath]);
    photoCleanupWarning = Boolean(removeError);
  }

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
  if (programmingLanguagesError || recruiterPreferencesError) {
    const migrationMissing = [programmingLanguagesError, recruiterPreferencesError].some(
      (updateError) => updateError?.code === "42703" || updateError?.code === "PGRST204",
    );
    const fields = [
      programmingLanguagesError ? "les langages de programmation" : null,
      recruiterPreferencesError ? "les préférences recruteurs" : null,
    ]
      .filter((field): field is string => field !== null)
      .join(" et ");
    const details = [programmingLanguagesError?.message, recruiterPreferencesError?.message]
      .filter((message): message is string => Boolean(message))
      .join(" · ");
    redirect(
      `/parametres?warning=profile-fields&error=${encodeURIComponent(
        migrationMissing
          ? `Le profil et la photo ont été enregistrés, mais ${fields} n’ont pas pu l’être. Applique les migrations Supabase puis réessaie.`
          : `Le profil et la photo ont été enregistrés, mais ${fields} n’ont pas pu l’être : ${details}`,
      )}`,
    );
  }
  redirect(photoCleanupWarning ? "/parametres?ok=1&warning=photo-cleanup" : "/parametres?ok=1");
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; warning?: string }> }) {
  const { supabase, user } = await requireSession("/parametres");
  const { error, ok, warning } = await searchParams;
  const [{ data: p }, { data: skills }, { data: badges }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_skills").select("source, skills(name)").eq("user_id", user.id),
    supabase.from("user_badges").select("badges(code, name, tier)").eq("user_id", user.id),
  ]);
  const skillNames = (source: string) =>
    (skills ?? [])
      .filter((s) => s.source === source)
      .map((s) => (s.skills as unknown as { name: string }).name);
  // Certains environnements peuvent encore contenir des profils créés avant
  // l'ajout des préférences recruteurs. Les valeurs par défaut permettent à la
  // page de rester consultable pendant la mise à niveau de la base.
  const languages = Array.isArray(p.languages) ? p.languages : [];
  const goals = Array.isArray(p.goals) ? p.goals : [];
  const pinnedBadges = Array.isArray(p.pinned_badges) ? p.pinned_badges : [];
  const openTo = Array.isArray(p.open_to) ? p.open_to : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Mon profil</h1>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}
      {ok && <p className="mt-4 rounded-lg bg-leaf/10 p-3 text-sm text-leaf">Profil enregistré.</p>}
      {warning === "photo-cleanup" && (
        <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
          Le profil est enregistré, mais l&apos;ancienne photo n&apos;a pas pu être supprimée.
        </p>
      )}

      <form action={saveProfile} className="mt-6 space-y-4">
        <div id="photo"><ProfilePhotoInput username={p.username} fullName={p.full_name} avatarUrl={p.avatar_url} /></div>
        <label className="block text-sm font-medium">
          Nom affiché
          <input name="full_name" defaultValue={p.full_name ?? ""} className={input} />
        </label>
        <label className="block text-sm font-medium">
          Bio
          <textarea name="bio" rows={3} defaultValue={p.bio ?? ""} className={input} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Pays
            <select name="country" defaultValue={p.country ?? ""} className={input}>
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Ville
            <input name="city" defaultValue={p.city ?? ""} className={input} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Langues (fr, en, wo, fon…)
            <input name="languages" defaultValue={languages.join(", ")} className={input} />
          </label>
          <label className="block text-sm font-medium">
            Fuseau horaire
            <input name="timezone" defaultValue={p.timezone ?? ""} className={input} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Langages de programmation qui t’intéressent (séparés par des virgules)
          <input
            name="programming_languages"
            defaultValue={p.programming_languages?.join(", ") ?? ""}
            placeholder="JavaScript, Python, PHP, Go"
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Disponibilité
          <select name="availability" defaultValue={p.availability ?? "available"} className={input}>
            <option value="available">Disponible</option>
            <option value="limited">Disponibilité limitée</option>
            <option value="busy">Occupé·e</option>
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Objectifs</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {GOALS.map((g) => (
              <label key={g} className="flex items-center gap-1.5">
                <input type="checkbox" name={`goal_${g}`} defaultChecked={goals.includes(g)} /> {g}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">
          Technologies déclarées (séparées par des virgules)
          <input name="skills" defaultValue={skillNames("manual").join(", ")} className={input} />
          {skillNames("github").length > 0 && (
            <span className="mt-1 block text-xs font-normal text-muted">Détectées sur GitHub : {skillNames("github").join(", ")}</span>
          )}
        </label>
        {badges && badges.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium">Badges épinglés (3 max.)</legend>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {badges.map((b) => {
                const badge = b.badges as unknown as { code: string; name: string; tier: string };
                return (
                  <label key={badge.code} className="flex items-center gap-1.5">
                    <input type="checkbox" name="pinned" value={badge.code} defaultChecked={pinnedBadges.includes(badge.code)} />
                    {badge.name} ({badge.tier})
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <fieldset className="rounded-lg border border-border bg-surface p-3">
          <legend className="px-1 text-sm font-medium">Recruteurs</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="recruiter_visible" defaultChecked={p.recruiter_visible ?? true} /> Mon profil apparaît dans la recherche des
            recruteurs abonnés
          </label>
          <p className="mt-1 text-xs text-muted">
            Aucun recruteur ne peut t&apos;écrire directement : tu reçois une proposition, que tu acceptes ou déclines dans{" "}
            <a href="/propositions" className="text-primary">
              Propositions
            </a>
            .
          </p>
          <p className="mt-3 text-sm">Ouvert·e à</p>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {OPEN_TO.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5">
                <input type="checkbox" name={`open_${o.value}`} defaultChecked={openTo.includes(o.value)} /> {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-border bg-surface p-3">
          <legend className="px-1 text-sm font-medium">Alertes WhatsApp</legend>
          <label className="block text-sm">
            Numéro WhatsApp (format international)
            <input name="whatsapp_number" defaultValue={p.whatsapp_number ?? ""} placeholder="+229 97 00 00 00" className={input} />
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="whatsapp_alerts" defaultChecked={p.whatsapp_alerts} /> Recevoir sur WhatsApp les opportunités du Radar qui
            correspondent à mon profil
          </label>
        </fieldset>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Enregistrer</button>
      </form>
    </main>
  );
}
