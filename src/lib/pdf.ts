import "server-only";

// Générateur PDF minimal, sans dépendance : texte en Helvetica (WinAnsi), retours à la ligne, plusieurs pages.
// Suffisant pour des documents contractuels sobres (accords, reçus).

export type PdfBlock = { text: string; bold?: boolean; size?: number; gap?: number; color?: [number, number, number]; indent?: number };

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;

// Caractères Unicode hors Latin-1 présents dans l'encodage WinAnsi
const WIN_ANSI: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "Œ": 0x8c, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "œ": 0x9c,
};

function toWinAnsi(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if (code === 0x202f || code === 0x2009) bytes.push(0x20);
    else if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) bytes.push(code);
    else bytes.push(WIN_ANSI[ch] ?? 0x3f);
  }
  return bytes;
}

// Chaîne PDF littérale : échappement des parenthèses et antislash, octets non ASCII en octal
function pdfString(text: string) {
  return (
    "(" +
    toWinAnsi(text)
      .map((b) => (b === 0x28 || b === 0x29 || b === 0x5c ? "\\" + String.fromCharCode(b) : b < 0x20 || b > 0x7e ? "\\" + b.toString(8).padStart(3, "0") : String.fromCharCode(b)))
      .join("") +
    ")"
  );
}

// Largeur approximative en Helvetica (unités de 1/1000 em), suffisante pour couper les lignes
function charWidth(ch: string, bold: boolean) {
  let w: number;
  if (" ".includes(ch)) w = 278;
  else if ("iljI.,;:'!|".includes(ch)) w = 240;
  else if ("ftr()[]-«»".includes(ch)) w = 333;
  else if ("mwMW@".includes(ch)) w = 870;
  else if (/[A-ZÀ-ÖØ-Þ]/.test(ch)) w = 690;
  else if (/[0-9]/.test(ch)) w = 556;
  else w = 540;
  return bold ? w * 1.06 : w;
}
const textWidth = (text: string, size: number, bold: boolean) => ([...text].reduce((n, c) => n + charWidth(c, bold), 0) * size) / 1000;

function wrap(text: string, size: number, bold: boolean, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) > width && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

export function renderPdf(blocks: PdfBlock[], { title, footer }: { title: string; footer?: string }): Uint8Array {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    if (ops.length) pages.push(ops.join("\n"));
    ops = [];
    y = PAGE_H - MARGIN;
  };

  for (const block of blocks) {
    const size = block.size ?? 10.5;
    const leading = size * 1.4;
    const indent = block.indent ?? 0;
    y -= block.gap ?? 0;
    for (const line of wrap(block.text, size, Boolean(block.bold), PAGE_W - 2 * MARGIN - indent)) {
      if (y - leading < MARGIN + 24) newPage();
      y -= leading;
      const [r, g, b] = block.color ?? [0.12, 0.1, 0.08];
      ops.push(`BT /${block.bold ? "F2" : "F1"} ${size} Tf ${r} ${g} ${b} rg ${(MARGIN + indent).toFixed(2)} ${y.toFixed(2)} Td ${pdfString(line)} Tj ET`);
    }
  }
  newPage();

  // Pied de page numéroté
  const total = pages.length;
  const contents = pages.map((content, i) => {
    const foot = `${footer ? `${footer} · ` : ""}Page ${i + 1}/${total}`;
    return `${content}\n0.73 0.34 0.1 RG 1 w ${MARGIN} ${MARGIN + 14} m ${PAGE_W - MARGIN} ${MARGIN + 14} l S\nBT /F1 8 Tf 0.42 0.37 0.31 rg ${MARGIN} ${MARGIN} Td ${pdfString(foot)} Tj ET`;
  });

  // Assemblage : catalogue, pages, polices, flux, métadonnées, table des références
  const objects: string[] = [];
  const add = (body: string) => objects.push(body); // numéro de l'objet (à partir de 1)
  const catalog = add("");
  const pagesObj = add("");
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  for (const content of contents) {
    const bytes = toWinAnsi(content).length;
    const stream = add(`<< /Length ${bytes} >>\nstream\n${content}\nendstream`);
    kids.push(
      add(
        `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${stream} 0 R >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const info = add(`<< /Title ${pdfString(title)} /Producer (Baobab Dev) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z) >>`);

  // Les flux de contenu sont déjà en WinAnsi (octets) : tout le fichier est écrit octet par octet
  const out: number[] = [];
  const write = (s: string) => {
    for (const b of toWinAnsi(s)) out.push(b);
  };
  write("%PDF-1.4\n%âãÏÓ\n");
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    write(`${i + 1} 0 obj\n${body}\nendobj\n`);
  });
  const xref = out.length;
  write(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const o of offsets) write(`${String(o).padStart(10, "0")} 00000 n \n`);
  write(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Uint8Array(out);
}
