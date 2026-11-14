"use client";

import { useEffect, useRef, useState } from "react";

export function ProfilePhotoInput({
  username,
  fullName,
  avatarUrl,
}: {
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const displayedUrl = previewUrl ?? (removePhoto ? null : avatarUrl);
  const initial = (fullName ?? username).charAt(0).toUpperCase();

  return (
    <fieldset className="rounded-xl border border-border bg-surface p-4">
      <legend className="px-1 text-sm font-medium">Photo de profil</legend>
      <div className="flex flex-wrap items-center gap-4">
        {displayedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayedUrl} alt="Aperçu de la photo de profil" className="h-20 w-20 rounded-full border border-border object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-ink"
          >
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-medium">
            Choisir une image
            <input
              ref={fileInputRef}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setFile(nextFile);
                if (nextFile) setRemovePhoto(false);
              }}
              className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-full file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-foreground"
            />
          </label>
          <p className="mt-1 text-xs text-muted">JPEG, PNG ou WebP · 3 Mo maximum. Visible sur ton profil public.</p>
          {avatarUrl && (
            <label className="mt-2 flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="remove_avatar"
                checked={removePhoto}
                onChange={(event) => {
                  setRemovePhoto(event.target.checked);
                  if (event.target.checked) {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
              />
              Retirer la photo actuelle
            </label>
          )}
        </div>
      </div>
    </fieldset>
  );
}
