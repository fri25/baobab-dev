"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";

type Props = {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  draftKey: string;
};

type Format = {
  label: string;
  title: string;
  before: string;
  after: string;
  placeholder: string;
};

const FORMATS: Format[] = [
  { label: "B", title: "Gras", before: "**", after: "**", placeholder: "texte en gras" },
  { label: "I", title: "Italique", before: "*", after: "*", placeholder: "texte en italique" },
  { label: "H2", title: "Titre", before: "## ", after: "", placeholder: "Titre" },
  { label: "• Liste", title: "Liste à puces", before: "- ", after: "", placeholder: "Élément de liste" },
  { label: "1. Liste", title: "Liste numérotée", before: "1. ", after: "", placeholder: "Élément de liste" },
  { label: "</>", title: "Bloc de code", before: "```text\n", after: "\n```", placeholder: "colle ton code ici" },
  { label: "Lien", title: "Lien", before: "[", after: "](https://)", placeholder: "texte du lien" },
];

export function MarkdownEditor({
  id,
  name,
  label,
  required = false,
  rows = 10,
  placeholder,
  draftKey,
}: Props) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [draftStatus, setDraftStatus] = useState<"saved" | "unavailable" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const storageKey = `brouillon:${draftKey}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setValue(saved);
        setDraftStatus("saved");
      }
    } catch {
      setDraftStatus("unavailable");
    }

    const form = textareaRef.current?.form;
    const clearDraft = () => {
      try {
        localStorage.removeItem(storageKey);
        setDraftStatus(null);
      } catch {
        setDraftStatus("unavailable");
      }
    };
    form?.addEventListener("submit", clearDraft);
    return () => form?.removeEventListener("submit", clearDraft);
  }, [storageKey]);

  function changeValue(next: string) {
    setValue(next);
    try {
      if (next) {
        localStorage.setItem(storageKey, next);
        setDraftStatus("saved");
      } else {
        localStorage.removeItem(storageKey);
        setDraftStatus(null);
      }
    } catch {
      setDraftStatus("unavailable");
    }
  }

  function formatText(format: Format) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);

    if (format.title === "Titre" || format.title === "Liste à puces" || format.title === "Liste numérotée") {
      const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const selectionEnd = end > start ? end : start;
      const nextLineBreak = value.indexOf("\n", selectionEnd);
      const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
      const selectedLines = value.slice(lineStart, lineEnd) || format.placeholder;
      const replacement = selectedLines
        .split("\n")
        .map((line) => `${format.before}${line}`)
        .join("\n");
      const next = `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`;
      changeValue(next);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart + replacement.length, lineStart + replacement.length);
      });
      return;
    }

    const content = selected || format.placeholder;
    const insertion = `${format.before}${content}${format.after}`;
    const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    const selectionStart = start + format.before.length;
    changeValue(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionStart + content.length);
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/70 px-3 py-2">
        <div className="flex items-center gap-1" role="group" aria-label={`${label} : mode d’édition`}>
          <button
            type="button"
            aria-pressed={mode === "write"}
            onClick={() => setMode("write")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === "write" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            Écrire
          </button>
          <button
            type="button"
            aria-pressed={mode === "preview"}
            onClick={() => setMode("preview")}
            disabled={required && !value.trim()}
            title={required && !value.trim() ? "Écris une description pour afficher l’aperçu." : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === "preview" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            Aperçu
          </button>
          {required && !value.trim() && (
            <span className="sr-only">Écris une description pour afficher l’aperçu.</span>
          )}
        </div>
        {mode === "write" && (
          <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={`Mise en forme de ${label}`}>
            {FORMATS.map((format) => (
              <button
                key={format.title}
                type="button"
                title={format.title}
                aria-label={format.title}
                onClick={() => formatText(format)}
                className="rounded-md border border-transparent px-2 py-1 text-xs font-semibold text-muted transition hover:border-border hover:bg-surface hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {format.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          id={id}
          name={name}
          value={value}
          required={required}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => changeValue(event.target.value)}
          className="block w-full resize-y bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
        />
      ) : (
        <>
          <input type="hidden" name={name} value={value} />
          <div aria-label={`Aperçu de ${label}`} className="min-h-48 px-4 py-3 text-sm">
            {value.trim() ? (
              <Markdown text={value} />
            ) : (
              <p className="text-muted">Ton aperçu apparaîtra ici.</p>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted">
        <span>Markdown pris en charge · **gras** · *italique* · listes · liens · ```code```</span>
        <span aria-live="polite">
          {draftStatus === "saved" ? "Brouillon enregistré sur cet appareil" : ""}
          {draftStatus === "unavailable" ? "Stockage local indisponible" : ""}
        </span>
      </div>
    </section>
  );
}
