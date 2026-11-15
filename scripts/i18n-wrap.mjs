// Codemod de traduction : entoure les textes visibles (texte JSX, aria-label, title, placeholder, alt)
// avec t("…"), ajoute `const t = await getT()` (composant serveur) ou `const t = useT()` (composant client)
// en tête du composant, et liste les phrases à traduire.
//
//   node scripts/i18n-wrap.mjs --list src/app/defis        → phrases trouvées, sans rien modifier
//   node scripts/i18n-wrap.mjs --apply src/app/defis       → modifie les fichiers
//   node scripts/i18n-wrap.mjs --missing                   → phrases utilisées sans traduction anglaise
//
// Ce qui n'est pas traité automatiquement (chaînes dans du JS, ternaires, métadonnées) est signalé.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const ATTRS = new Set(["aria-label", "title", "placeholder", "alt"]);
const SKIP_TAGS = new Set(["code", "pre", "style", "script", "kbd", "T"]);
const HAS_WORD = /[A-Za-zÀ-ÿ]{2,}/;

const args = process.argv.slice(2);
const mode = args[0];
const targets = args.slice(1);

function walkFiles(p, out = []) {
  const abs = path.resolve(ROOT, p);
  if (fs.statSync(abs).isDirectory()) for (const f of fs.readdirSync(abs)) walkFiles(path.join(abs, f), out);
  else if (abs.endsWith(".tsx")) out.push(abs);
  return out;
}

const decode = (s) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&rsquo;/g, "’").replace(/&laquo;/g, "«").replace(/&raquo;/g, "»").replace(/&amp;/g, "&");

// Fichiers sans directive importés par un composant client : ils tournent aussi côté client.
function clientImported(allFiles) {
  const shared = new Set();
  for (const f of allFiles) {
    const src = fs.readFileSync(f, "utf8");
    if (!/^\s*["']use client["']/.test(src)) continue;
    for (const m of src.matchAll(/from\s+["'](@\/[^"']+|\.{1,2}\/[^"']+)["']/g)) {
      const spec = m[1];
      const base = spec.startsWith("@/") ? path.join(ROOT, "src", spec.slice(2)) : path.resolve(path.dirname(f), spec);
      for (const ext of [".tsx", ".ts", "/index.tsx"]) if (fs.existsSync(base + ext)) shared.add(path.normalize(base + ext));
    }
  }
  return shared;
}

function componentOf(node) {
  // Remonte jusqu'à la fonction nommée en Majuscule (composant React)
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) return n;
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) && /^[A-Z]/.test(n.parent.name.text))
      return n;
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === "default") return n;
    if (ts.isFunctionDeclaration(n) && !n.name) return n; // export default function () {}
  }
  return null;
}

function insideSkippedTag(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isJsxElement(n)) {
      const tag = n.openingElement.tagName.getText();
      if (SKIP_TAGS.has(tag)) return true;
    }
  }
  return false;
}

// Chaîne affichée telle quelle : {"…"}, {c ? "…" : "…"}, {c && "…"}, dans un élément ou un attribut traduit
function inJsxText(node) {
  const LOGICAL = [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken];
  let n = node;
  while (
    ts.isParenthesizedExpression(n.parent) ||
    (ts.isConditionalExpression(n.parent) && n.parent.condition !== n) ||
    (ts.isBinaryExpression(n.parent) && n.parent.right === n && LOGICAL.includes(n.parent.operatorToken.kind))
  )
    n = n.parent;
  if (!n.parent || !ts.isJsxExpression(n.parent)) return false;
  const holder = n.parent.parent;
  if (ts.isJsxElement(holder) || ts.isJsxFragment(holder)) return true;
  return ts.isJsxAttribute(holder) && ATTRS.has(holder.name.getText());
}

function declaresT(fn) {
  let found = false;
  const visit = (n) => {
    if ((ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name) && n.name.text === "t") found = true;
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(fn, visit);
  return found;
}

function processFile(file, shared, apply) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const isClient = /^\s*["']use client["']/.test(src);
  if (/^\s*["']use server["']/.test(src)) return { strings: [], manual: [] };
  const isShared = !isClient && shared.has(path.normalize(file));
  const edits = []; // { start, end, text }
  const strings = [];
  const manual = [];
  const comps = new Map(); // fn -> name

  const nameFor = (fn) => {
    if (!comps.has(fn)) comps.set(fn, declaresT(fn) ? "tr" : "t");
    return comps.get(fn);
  };

  const visit = (node) => {
    if (ts.isJsxText(node) && HAS_WORD.test(node.text) && !insideSkippedTag(node)) {
      const raw = node.text;
      const core = decode(raw.replace(/\s+/g, " ").trim());
      const fn = componentOf(node);
      if (!fn || isShared) manual.push(core);
      else {
        // JSX garde un espace qui ne contient pas de retour à la ligne : on le conserve avec {" "}
        // Espace sans retour à la ligne : significatif en JSX, gardé avec {" "}. Avec retour : recopié tel quel.
        const ws = (w) => (!w ? "" : w.includes("\n") ? w : '{" "}');
        const lead = raw.match(/^\s*/)[0];
        const trail = raw.match(/\s*$/)[0];
        const t = nameFor(fn);
        edits.push({ start: node.pos, end: node.end, text: `${ws(lead)}{${t}(${JSON.stringify(core)})}${ws(trail)}` });
        strings.push(core);
      }
    }
    if (ts.isStringLiteral(node) && HAS_WORD.test(node.text) && inJsxText(node) && !insideSkippedTag(node)) {
      const fn = componentOf(node);
      if (!fn || isShared) manual.push(node.text);
      else {
        const t = nameFor(fn);
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `${t}(${JSON.stringify(node.text)})` });
        strings.push(node.text);
      }
    }
    if (ts.isJsxAttribute(node) && ATTRS.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer) && HAS_WORD.test(node.initializer.text)) {
      const fn = componentOf(node);
      const value = node.initializer.text;
      if (!fn || isShared) manual.push(value);
      else {
        const t = nameFor(fn);
        edits.push({ start: node.initializer.getStart(sf), end: node.initializer.getEnd(), text: `{${t}(${JSON.stringify(value)})}` });
        strings.push(value);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (apply && edits.length) {
    for (const [fn, t] of comps) {
      const body = fn.body;
      const decl = isClient ? `const ${t} = useT();` : `const ${t} = await getT();`;
      if (body && ts.isBlock(body)) {
        // déjà déclaré ?
        if (!body.statements.some((s) => s.getText(sf).startsWith(`const ${t} = `)))
          edits.push({ start: body.getStart(sf) + 1, end: body.getStart(sf) + 1, text: `\n  ${decl}` });
      } else if (body) {
        edits.push({ start: body.getStart(sf), end: body.getStart(sf), text: `{\n  ${decl}\n  return ` });
        edits.push({ start: body.getEnd(), end: body.getEnd(), text: `;\n}` });
      }
      if (!isClient && !fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
        const at = ts.isArrowFunction(fn) ? fn.getStart(sf) : fn.modifiers?.length ? fn.modifiers[fn.modifiers.length - 1].getEnd() + 1 : fn.getStart(sf);
        edits.push({ start: at, end: at, text: "async " });
      }
    }
    const imp = isClient ? `import { useT } from "@/lib/i18n/client";\n` : `import { getT } from "@/lib/i18n/server";\n`;
    const already = isClient ? src.includes('from "@/lib/i18n/client"') : src.includes('from "@/lib/i18n/server"');
    if (!already) {
      const firstImport = sf.statements.find((s) => ts.isImportDeclaration(s));
      const at = firstImport ? firstImport.getStart(sf) : 0;
      edits.push({ start: at, end: at, text: imp });
    }
    edits.sort((a, b) => b.start - a.start || b.end - a.end);
    let out = src;
    for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    fs.writeFileSync(file, out);
  }
  return { strings, manual };
}

async function missing() {
  const { en } = await import(new URL("../src/lib/i18n/en.ts", import.meta.url).href).catch(() => ({ en: null }));
  const dict = en ?? parseEn();
  const used = new Set();
  for (const f of walkFiles("src")) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/\b(?:t|tr)\((\"(?:[^"\\]|\\.)*\")/g)) used.add(JSON.parse(m[1]));
  }
  const miss = [...used].filter((s) => !(s in dict) && !(s.replace(/[  ]/g, " ") in dict));
  console.log(JSON.stringify(miss, null, 1));
  console.error(`${miss.length} phrase(s) sans traduction sur ${used.size}`);
}
function parseEn() {
  const src = fs.readFileSync(path.join(ROOT, "src/lib/i18n/en.ts"), "utf8");
  const dict = {};
  for (const m of src.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*"),?\s*$/gm)) dict[JSON.parse(m[1])] = JSON.parse(m[2]);
  return dict;
}

if (mode === "--missing") await missing();
else {
  const all = walkFiles("src");
  const shared = clientImported(all);
  const files = targets.flatMap((t) => walkFiles(t));
  const seen = new Set();
  let manualCount = 0;
  for (const f of files) {
    const { strings, manual } = processFile(f, shared, mode === "--apply");
    strings.forEach((s) => seen.add(s));
    if (manual.length) {
      manualCount += manual.length;
      console.error(`À traiter à la main dans ${path.relative(ROOT, f)} : ${manual.length}`);
    }
  }
  if (mode === "--list") console.log(JSON.stringify([...seen], null, 1));
  console.error(`${seen.size} phrase(s) distinctes, ${manualCount} à la main, ${files.length} fichier(s)`);
}
