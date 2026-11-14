export function markdownSummary(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " Code inclus. ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/(\*\*|__|~~|`|[*_])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
