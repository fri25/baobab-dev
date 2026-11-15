import hljs from "highlight.js/lib/common";

const MAX_LINES = 12;

/** Premier bloc de code d'un texte Markdown : { language, code } ou null */
export function firstCodeBlock(markdown: string) {
  const match = markdown.match(/```([\w+#.-]*)[^\n]*\n([\s\S]*?)```/);
  if (!match || !match[2].trim()) return null;
  return { language: match[1].toLowerCase(), code: match[2].replace(/\s+$/, "") };
}

// Aperçu de code d'une carte du fil : numéros de ligne, coloration, coupé à 12 lignes
export function CodePreview({ code, language, label }: { code: string; language: string; label?: string }) {
  const lines = code.split("\n");
  const shown = lines.slice(0, MAX_LINES).join("\n");
  const known = Boolean(language && hljs.getLanguage(language));
  const html = known ? hljs.highlight(shown, { language, ignoreIllegals: true }).value : null;
  const count = Math.min(lines.length, MAX_LINES);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="truncate font-mono text-xs text-[#8b949e]">{label ?? (language || "code")}</span>
      </div>
      <div className="flex overflow-x-auto py-3 font-mono text-[13px] leading-relaxed">
        <span aria-hidden="true" className="select-none px-3 text-right text-[#484f58]">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className="block">
              {String(i + 1).padStart(2, "0")}
            </span>
          ))}
        </span>
        <pre className="m-0 min-w-0 flex-1 pr-4">
          {html ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /> : <code>{shown}</code>}
        </pre>
      </div>
      {lines.length > MAX_LINES && <p className="border-t border-white/10 px-3 py-1.5 font-mono text-[11px] text-[#8b949e]">+ {lines.length - MAX_LINES} …</p>}
    </div>
  );
}
