"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_QUESTION_IMAGES, QUESTION_IMAGES_BUCKET } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

type Uploaded = { url: string; path: string; kb: number };

const MAX_SIDE = 1600;

// Compression avant l'envoi : une capture de 2 Mo devient ~100-200 Ko en WebP
async function compress(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file; // garde l'animation
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.75));
  return blob && blob.size < file.size ? blob : file;
}

export function ImageUploader({ userId, name = "images" }: { userId: string; name?: string }) {
  const [images, setImages] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);
  countRef.current = images.length + busy;

  async function add(files: File[]) {
    setError(null);
    const room = MAX_QUESTION_IMAGES - countRef.current;
    const accepted = files.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(room, 0));
    if (files.length > accepted.length) setError(`${MAX_QUESTION_IMAGES} images maximum.`);
    if (!accepted.length) return;

    const supabase = createClient();
    setBusy((b) => b + accepted.length);
    await Promise.all(
      accepted.map(async (file) => {
        try {
          const blob = await compress(file);
          if (blob.size > 1024 * 1024) throw new Error("Image trop lourde, même compressée (1 Mo max.)");
          const ext = blob.type === "image/webp" ? "webp" : (file.name.split(".").pop()?.toLowerCase() ?? "png");
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(QUESTION_IMAGES_BUCKET)
            .upload(path, blob, { contentType: blob.type || file.type, cacheControl: "31536000" });
          if (upErr) throw upErr;
          const { data } = supabase.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(path);
          setImages((list) => [...list, { url: data.publicUrl, path, kb: Math.round(blob.size / 1024) }]);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Échec de l'envoi de l'image.");
        } finally {
          setBusy((b) => b - 1);
        }
      }),
    );
  }

  async function remove(image: Uploaded) {
    setImages((list) => list.filter((i) => i.path !== image.path));
    await createClient().storage.from(QUESTION_IMAGES_BUCKET).remove([image.path]);
  }

  // Coller une capture d'écran (Ctrl+V) n'importe où dans le formulaire
  useEffect(() => {
    const form = zoneRef.current?.closest("form");
    if (!form) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        add(files);
      }
    };
    form.addEventListener("paste", onPaste);
    return () => form.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const full = images.length + busy >= MAX_QUESTION_IMAGES;

  return (
    <div
      ref={zoneRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        add(Array.from(e.dataTransfer.files));
      }}
    >
      <p className="text-sm font-medium">Images (facultatif)</p>
      <p className="text-xs text-muted">
        Capture d&apos;écran d&apos;une erreur, maquette… {MAX_QUESTION_IMAGES} max. Colle-les avec Ctrl+V ou glisse-les ici :
        elles sont compressées avant l&apos;envoi.
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {images.map((img) => (
          <div key={img.path} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">{img.kb} Ko</span>
            <button
              type="button"
              onClick={() => remove(img)}
              aria-label="Retirer l'image"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs text-background"
            >
              ✕
            </button>
            <input type="hidden" name={name} value={img.url} />
          </div>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <div key={`busy-${i}`} className="flex h-20 w-20 animate-pulse items-center justify-center rounded-lg border border-border text-xs text-muted">
            envoi…
          </div>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted hover:border-primary hover:text-primary"
          >
            <span className="text-xl">+</span>
            Ajouter
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {error && <p className="mt-1 text-xs text-primary">{error}</p>}
    </div>
  );
}
