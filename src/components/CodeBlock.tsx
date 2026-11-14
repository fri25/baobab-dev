"use client";

import { useState } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const languages = {
  bash,
  c,
  cpp,
  csharp,
  css,
  go,
  java,
  javascript,
  json,
  php,
  python,
  ruby,
  rust,
  sql,
  typescript,
  xml,
  yaml,
};

Object.entries(languages).forEach(([name, language]) => hljs.registerLanguage(name, language));

const aliases: Record<string, string> = {
  c: "c",
  csharp: "csharp",
  cs: "csharp",
  cxx: "cpp",
  h: "c",
  hpp: "cpp",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml",
};

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const normalizedLanguage = aliases[language] ?? language;
  const highlighted = Boolean(language && hljs.getLanguage(normalizedLanguage));
  const html = highlighted
    ? hljs.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value
    : "";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div
      className="markdown-code min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-[#0d1117] text-[#c9d1d9]"
      data-lang={language || undefined}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <span className="font-mono text-xs text-[#e3b341]">{language || "code"}</span>
        <button
          type="button"
          onClick={copyCode}
          className="shrink-0 rounded border border-white/15 px-2 py-1 text-xs text-[#c9d1d9] transition hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e3b341]"
          aria-live="polite"
        >
          {copyStatus === "copied" ? "Copié" : copyStatus === "failed" ? "Copie impossible" : "Copier"}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto px-4 py-3 text-sm leading-relaxed">
        {highlighted ? (
          <code className="hljs font-mono" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code className="font-mono">{code}</code>
        )}
      </pre>
    </div>
  );
}
