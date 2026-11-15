"use client";

import { useT } from "@/lib/i18n/client";
import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { removeAvatar, setAvatar } from "./avatar-actions";

const SIDE = 512;

// Recadrage carré centré et compression WebP : une photo de 4 Mo devient ~40 Ko
async function squareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIDE, side);
  canvas.getContext("2d")!.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    // Légèrement au-dessus du centre : le visage est rarement au milieu exact d'un portrait
    Math.max(0, (bitmap.height - side) / 2 - (bitmap.height > bitmap.width ? side * 0.1 : 0)),
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Image illisible");
  return blob;
}

export function AvatarUploader({
  user,
}: {
  user: { id: string; username: string; full_name: string | null; avatar_url: string | null; github_avatar: string | null };
}) {
  const t = useT();
  const [url, setUrl] = useState(user.avatar_url);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setMessage(null);
    if (!file.type.startsWith("image/")) return setMessage({ ok: false, text: "Choisis une image (JPEG, PNG ou WebP)." });
    setBusy(true);
    try {
      const blob = await squareWebp(file);
      const path = `${user.id}/${crypto.randomUUID()}.webp`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const res = await setAvatar(data.publicUrl);
      if (res.error) throw new Error(res.error);
      setUrl(data.publicUrl);
      setMessage({ ok: true, text: `Photo enregistrée (${Math.round(blob.size / 1024)} Ko).` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Échec de l'envoi." });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    const res = await removeAvatar();
    setBusy(false);
    if (res.error) return setMessage({ ok: false, text: res.error });
    setUrl(res.url);
    setMessage({ ok: true, text: res.url ? "Photo GitHub rétablie." : "Photo retirée." });
  }

  return (
    <section className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-surface p-4">
      <div
        className="relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) upload(file);
        }}
      >
        <Avatar user={{ ...user, avatar_url: url }} size={96} />
        {busy && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs text-white">{t("envoi…")}</span>}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{t("Photo de profil professionnelle")}</p>
        <p className="text-xs text-muted">
          {t("Visage bien éclairé, cadré des épaules, fond neutre. Elle apparaît sur ton profil, tes réponses et dans l'espace recruteurs. Recadrée en carré et compressée sur ton téléphone avant l'envoi.")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-ink disabled:opacity-50"
          >
            {url ? t("Changer la photo") : t("Ajouter une photo")}
          </button>
          {url && (
            <button type="button" disabled={busy} onClick={reset} className="rounded-full border border-border px-4 py-1.5 text-xs disabled:opacity-50">
              {user.github_avatar && url !== user.github_avatar ? t("Revenir à la photo GitHub") : t("Retirer")}
            </button>
          )}
        </div>
        {message && <p className={`mt-1 text-xs ${message.ok ? "text-leaf" : "text-primary"}`}>{message.text}</p>}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
