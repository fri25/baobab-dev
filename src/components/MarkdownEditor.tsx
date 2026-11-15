"use client";

import { useT } from "@/lib/i18n/client";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";

type Props = {
  name: string;
  id?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  defaultValue?: string;
  draftKey?: string; // brouillon conservé sur l'appareil (§9)
};

type Action = { label: string; title: string; run: (sel: string) => { text: string; select?: [number, number] }; block?: boolean };

const ACTIONS: Action[] = [
  { label: "H", title: "Titre", block: true, run: (s) => ({ text: `## ${s || "Titre"}` }) },
  { label: "B", title: "Gras (Ctrl+B)", run: (s) => ({ text: `**${s || "texte en gras"}**`, select: [2, 2 + (s || "texte en gras").length] }) },
  { label: "I", title: "Italique (Ctrl+I)", run: (s) => ({ text: `*${s || "texte en italique"}*`, select: [1, 1 + (s || "texte en italique").length] }) },
  { label: "</>", title: "Code en ligne", run: (s) => ({ text: `\`${s || "code"}\``, select: [1, 1 + (s || "code").length] }) },
  { label: "{ }", title: "Bloc de code", block: true, run: (s) => ({ text: `\`\`\`js\n${s || "// ton code ici"}\n\`\`\`` }) },
  { label: "🔗", title: "Lien (Ctrl+K)", run: (s) => ({ text: `[${s || "texte du lien"}](https://)`, select: [(s || "texte du lien").length + 3, (s || "texte du lien").length + 11] }) },
  { label: "•", title: "Liste à puces", block: true, run: (s) => ({ text: (s || "élément").split("\n").map((l) => `- ${l}`).join("\n") }) },
  { label: "1.", title: "Liste numérotée", block: true, run: (s) => ({ text: (s || "élément").split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n") }) },
  { label: "❝", title: "Citation", block: true, run: (s) => ({ text: (s || "citation").split("\n").map((l) => `> ${l}`).join("\n") }) },
];

// Éditeur Markdown léger : barre d'outils, raccourcis clavier et aperçu fidèle au rendu publié.
export function MarkdownEditor({ name, id, required, rows = 10, maxLength, placeholder, defaultValue = "", draftKey }: Props) {
  const t = useT();
  const key = draftKey ? `brouillon:${draftKey}` : null;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!key) return;
    try {
      const draft = localStorage.getItem(key);
      if (draft && !defaultValue) {
        setValue(draft);
        setRestored(true);
      }
    } catch {}
    const form = ref.current?.form;
    const clear = () => {
      try {
        localStorage.removeItem(key);
      } catch {}
    };
    form?.addEventListener("submit", clear);
    return () => form?.removeEventListener("submit", clear);
  }, [key, defaultValue]);

  function update(next: string) {
    setValue(next);
    if (!key) return;
    try {
      if (next) localStorage.setItem(key, next);
      else localStorage.removeItem(key);
    } catch {}
  }

  function apply(action: Action) {
    const el = ref.current;
    if (!el) return;
    setTab("write");
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const { text, select } = action.run(selected);
    // Les blocs (titre, liste, code…) commencent sur une nouvelle ligne
    const before = value.slice(0, start);
    const prefix = action.block && before && !before.endsWith("\n") ? "\n\n" : "";
    const next = before + prefix + text + value.slice(end);
    update(next);
    requestAnimationFrame(() => {
      el.focus();
      const base = start + prefix.length;
      if (select) el.setSelectionRange(base + select[0], base + select[1]);
      else el.setSelectionRange(base + text.length, base + text.length);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const shortcut = { b: ACTIONS[1], i: ACTIONS[2], k: ACTIONS[5] }[e.key.toLowerCase()];
    if (shortcut) {
      e.preventDefault();
      apply(shortcut);
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1 text-sm ${active ? "bg-surface font-medium text-foreground shadow-sm" : "text-muted hover:text-foreground"}`;

  return (
    <div className="mt-1 overflow-hidden rounded-lg border border-border bg-surface focus-within:border-primary">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-2 py-1.5">
        <div className="flex gap-1 rounded-lg bg-border/40 p-0.5" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")} className={tabClass(tab === "write")}>
            {t("Écrire")}
          </button>
          <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")} className={tabClass(tab === "preview")}>
            {t("Aperçu")}
          </button>
        </div>
        <div className="flex flex-wrap gap-0.5" aria-label={t("Mise en forme")}>
          {ACTIONS.map((a) => (
            <button
              key={a.title}
              type="button"
              title={a.title}
              aria-label={a.title}
              onClick={() => apply(a)}
              className={`h-8 min-w-8 rounded-md px-1.5 font-mono text-sm text-muted hover:bg-surface hover:text-foreground ${
                a.label === "B" ? "font-bold" : a.label === "I" ? "italic" : ""
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        ref={ref}
        id={id}
        name={name}
        required={required}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => update(e.target.value)}
        onKeyDown={onKeyDown}
        onInvalid={() => setTab("write")}
        className={`block w-full resize-y bg-surface px-3 py-2 font-mono text-sm outline-none ${tab === "preview" ? "hidden" : ""}`}
      />
      {tab === "preview" && (
        <div className="min-h-40 px-4 py-3" style={{ minHeight: `${rows * 1.5}rem` }}>
          {value.trim() ? <Markdown text={value} /> : <p className="text-sm text-muted">{t("Rien à prévisualiser pour l'instant.")}</p>}
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 border-t border-border bg-background px-3 py-1.5 text-xs text-muted">
        <span>
          {t("Markdown : **gras**, *italique*, `code`, ```bloc```, [lien](url), - liste, ## titre")}
        </span>
        <span>
          {restored && t("Brouillon restauré · ")}
          {maxLength ? `${value.length}/${maxLength}` : `${value.length} caractères`}
        </span>
      </div>
    </div>
  );
}
