// Miroir de public.level_for_xp (§5.7 du cahier des charges)
export const LEVELS = [
  { level: 1, name: "Graine", floor: 0 },
  { level: 2, name: "Pousse", floor: 100 },
  { level: 3, name: "Jeune Baobab", floor: 300 },
  { level: 4, name: "Bâtisseur", floor: 800 },
  { level: 5, name: "Expert", floor: 2000 },
  { level: 6, name: "Griot du Code", floor: 5000 },
  { level: 7, name: "Légende Baobab", floor: 10000 },
] as const;

export function levelForXp(xp: number) {
  const index = LEVELS.findLastIndex((l) => xp >= l.floor);
  const current = LEVELS[Math.max(index, 0)];
  const next = LEVELS[index + 1];
  const progress = next ? (xp - current.floor) / (next.floor - current.floor) : 1;
  return { ...current, next, progress };
}
