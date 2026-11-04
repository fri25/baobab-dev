"use client";

import { useEffect, useRef, useState } from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { draftKey: string };

// Brouillon conservé sur l'appareil, même sans connexion (§9). Effacé à l'envoi du formulaire.
export function DraftTextarea({ draftKey, defaultValue, ...props }: Props) {
  const key = `brouillon:${draftKey}`;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const draft = localStorage.getItem(key);
      if (draft && !el.value) {
        el.value = draft;
        setSaved(true);
      }
    } catch {}
    const form = el.form;
    const clear = () => {
      try {
        localStorage.removeItem(key);
      } catch {}
    };
    form?.addEventListener("submit", clear);
    return () => form?.removeEventListener("submit", clear);
  }, [key]);

  return (
    <>
      <textarea
        ref={ref}
        defaultValue={defaultValue}
        onChange={(e) => {
          try {
            if (e.target.value) localStorage.setItem(key, e.target.value);
            else localStorage.removeItem(key);
            setSaved(Boolean(e.target.value));
          } catch {}
          props.onChange?.(e);
        }}
        {...props}
      />
      {saved && <span className="text-xs text-muted">Brouillon enregistré sur cet appareil.</span>}
    </>
  );
}
