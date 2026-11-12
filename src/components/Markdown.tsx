"use client";

import dynamic from "next/dynamic";
import { Fragment } from "react";

const CodeBlock = dynamic(() => import("@/components/CodeBlock").then((module) => module.CodeBlock));

// Rendu minimal des blocs de code, du code en ligne, du gras, des paragraphes et des listes.
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\*[^*\n]+\*|\[[^\]]+\]\((?:https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)|\[\d+\]|(?<![\w.])@[a-z0-9_]{2,})/g);
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
        if (part.startsWith("_") && part.endsWith("_")) return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
        const markdownLink = part.match(/^\[([^\]]+)\]\((.+)\)$/);
        if (markdownLink) {
          const href = markdownLink[2];
          const external = /^https?:\/\//i.test(href);
          return (
            <a
              key={i}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="text-primary underline-offset-2 hover:underline"
            >
              {markdownLink[1]}
            </a>
          );
        }
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
            const heading = para.match(/^\s*(#{1,3})\s+(.+)$/);
            if (heading) {
              const Heading = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
              return (
                <Heading key={`${i}-${j}`} className="font-semibold">
                  <Inline text={heading[2]} />
                </Heading>
              );
            }
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
            if (lines.every((l) => /^\s*\d+[.)] /.test(l)))
              return (
                <ol key={`${i}-${j}`} className="list-decimal space-y-1 pl-5">
                  {lines.map((l, k) => (
                    <li key={k}>
                      <Inline text={l.replace(/^\s*\d+[.)] /, "")} />
                    </li>
                  ))}
                </ol>
              );
            if (lines.every((l) => /^\s*>/.test(l)))
              return (
                <blockquote key={`${i}-${j}`} className="border-l-2 border-primary/40 pl-3 text-muted">
                  <Inline text={lines.map((line) => line.replace(/^\s*> ?/, "")).join("\n")} />
                </blockquote>
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
