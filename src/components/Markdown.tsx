import { Fragment } from "react";

// Rendu volontairement minimal (pas de bibliothèque : page légère) :
// blocs ```code```, `code en ligne`, **gras**, *italique*, [liens](https://…), titres #, listes « - » et « 1. », citations « > ».
// Aucun HTML brut n'est interprété : tout passe par React, donc échappé.
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|(?<![*\w])\*[^*\s][^*]*\*(?!\*)|(?<![\w])_[^_\s][^_]*_(?![\w])|\[[^\]]+\]\([^)\s]+\)|\[\d+\]|(?<![\w.])@[a-z0-9_]{2,})/g;

const safeHref = (href: string) => (/^(https?:\/\/|\/(?!\/)|#)/i.test(href) ? href : null);

function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
          return (
            <code key={i} className="rounded bg-background px-1 py-0.5 font-mono text-[0.9em]">
              {part.slice(1, -1)}
            </code>
          );
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}><Inline text={part.slice(2, -2)} /></strong>;
        if (/^\*[^*].*\*$/.test(part) || /^_[^_].*_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
        const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) {
          const href = safeHref(link[2]);
          if (!href) return <Fragment key={i}>{link[1]}</Fragment>;
          const external = /^https?:/i.test(href);
          return (
            <a key={i} href={href} className="text-primary underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>
              {link[1]}
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

const HEADING = ["text-xl font-bold", "text-lg font-bold", "text-base font-semibold"];

function Paragraph({ para }: { para: string }) {
  const lines = para.split("\n");
  const heading = lines.length === 1 && para.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    const level = heading[1].length;
    const Tag = (["h2", "h3", "h4"] as const)[level - 1];
    return (
      <Tag className={HEADING[level - 1]}>
        <Inline text={heading[2]} />
      </Tag>
    );
  }
  if (lines.every((l) => /^\s*[-*] /.test(l)))
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((l, k) => (
          <li key={k}>
            <Inline text={l.replace(/^\s*[-*] /, "")} />
          </li>
        ))}
      </ul>
    );
  if (lines.every((l) => /^\s*\d+[.)] /.test(l)))
    return (
      <ol className="list-decimal space-y-1 pl-5">
        {lines.map((l, k) => (
          <li key={k}>
            <Inline text={l.replace(/^\s*\d+[.)] /, "")} />
          </li>
        ))}
      </ol>
    );
  if (lines.every((l) => /^>\s?/.test(l)))
    return (
      <blockquote className="whitespace-pre-line border-l-4 border-border pl-3 text-muted">
        <Inline text={lines.map((l) => l.replace(/^>\s?/, "")).join("\n")} />
      </blockquote>
    );
  return (
    <p className="whitespace-pre-line">
      <Inline text={para} />
    </p>
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, i) => {
        if (i % 2 === 1) {
          const [first, ...rest] = block.split("\n");
          const lang = first.trim();
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg border border-border bg-[#1f1a14] p-4 text-sm text-[#f3ece2]"
              data-lang={lang || undefined}
            >
              {lang && <span className="mb-2 block font-mono text-xs text-[#e0823f]">{lang}</span>}
              <code className="font-mono">{rest.join("\n").replace(/\n$/, "")}</code>
            </pre>
          );
        }
        // Un titre isolé sur une ligne forme son propre bloc, même sans ligne vide autour
        return block
          .replace(/^(#{1,3} .+)$/gm, "\n$1\n")
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((para, j) => <Paragraph key={`${i}-${j}`} para={para.trim()} />);
      })}
    </div>
  );
}
