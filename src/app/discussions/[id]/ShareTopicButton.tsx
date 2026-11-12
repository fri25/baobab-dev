"use client";

import { useState } from "react";

export function ShareTopicButton() {
  const [status, setStatus] = useState("");

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setStatus("Lien copié.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Partage indisponible. Tu peux copier le lien depuis la barre d’adresse.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={share}
        className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-background"
      >
        Partager le sujet
      </button>
      {status && (
        <p className="mt-1 text-xs text-muted" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
