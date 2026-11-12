"use client";

import dynamic from "next/dynamic";
import { Fragment } from "react";

const CodeBlock = dynamic(() => import("@/components/CodeBlock").then((module) => module.CodeBlock));

// Rendu minimal des blocs de code, du code en ligne, du gras, des paragraphes et des listes.
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[\d+\]|(?<![\w.])@[a-z0-9_]{2,})/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`"))
          return (
            <code key={i} className="rounded bg-background px-1 py-0.5 font-mono text-[0.9em]">
              {part.slice(1, -1)}
            </code>
          );
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (/^@[a-z0-9_]{2,}$/.test(part))
          return (
            <a key={i} href={`/u/${part.slice(1)}`} className="font-medium text-primary hover:underline">
              {part}
            </a>
          );
        if (/^\[\d+\]$/.test(part))
          return (
            <a key={i} href={`#source-${part.slice(1, -1)}`} className="font-mono text-xs text-primary align-super">
              {part}
            </a>
          );
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, i) => {
        if (i % 2 === 1) {
          const [first, ...rest] = block.split("\n");
          const lang = first.trim().split(/\s+/, 1)[0].toLowerCase();
          const code = rest.join("\n").replace(/\n$/, "");
          return <CodeBlock key={i} code={code} language={lang} />;
        }
        return block
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((para, j) => {
            const lines = para.split("\n");
            if (lines.every((l) => /^\s*[-*] /.test(l)))
              return (
                <ul key={`${i}-${j}`} className="list-disc space-y-1 pl-5">
                  {lines.map((l, k) => (
                    <li key={k}>
                      <Inline text={l.replace(/^\s*[-*] /, "")} />
                    </li>
                  ))}
                </ul>
              );
            return (
              <p key={`${i}-${j}`} className="whitespace-pre-line">
                <Inline text={para} />
              </p>
            );
          });
      })}
    </div>
  );
}
