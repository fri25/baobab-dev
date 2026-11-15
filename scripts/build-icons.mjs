// Génère public/icon.svg (favicon) et public/icon-maskable.svg (icône d'application) à partir
// des tracés du logo (src/components/Logo.tsx). À relancer après une modification du logo :
//   node scripts/build-icons.mjs
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/components/Logo.tsx", import.meta.url), "utf8");
const grab = (name) => {
  const start = src.indexOf(`export const ${name} = [`);
  const end = src.indexOf("];", start);
  return [...src.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
};
const paths = (list, color, width) => list.map((d) => `<path d="${d}" stroke="${color}" stroke-width="${width}"/>`).join("");
const mark = `${paths(grab("LOGO_CROWN"), "#5EE0A8", 2.6)}${paths(grab("LOGO_CODE"), "#5EE0A8", 2.2)}${paths(grab("LOGO_TRUNK"), "#FFFFFF", 2.6)}`;
const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>\n`;

// Favicon : fond bleu nuit arrondi, logo pleine taille
fs.writeFileSync(new URL("../public/icon.svg", import.meta.url), svg(`<rect width="64" height="64" rx="12" fill="#0B1526"/>${mark}`));
// Maskable : le système peut rogner jusqu'à 20 % sur les bords, le logo est réduit au centre
fs.writeFileSync(
  new URL("../public/icon-maskable.svg", import.meta.url),
  svg(`<rect width="64" height="64" fill="#0B1526"/><g transform="translate(9.6 9.6) scale(0.7)">${mark}</g>`),
);
console.log("icon.svg et icon-maskable.svg générés");
