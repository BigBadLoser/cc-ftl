import { XP_LEVEL_COST, XP_MAX_LEVEL } from '../tuning';

/** Total XP needed for `levels` XP levels (docs/TRAITS.md section 3): level n costs XP_LEVEL_COST x n^2 on top of the levels before it. */
export function xpForLevels(levels: number): number {
  return (XP_LEVEL_COST * levels * (levels + 1) * (2 * levels + 1)) / 6;
}

/** Most XP levels a skill with this starting level can still earn: base plus XP stops at XP_MAX_LEVEL (10). */
export const xpRoom = (base = 0): number => Math.max(0, XP_MAX_LEVEL - Math.max(0, Math.floor(base)));

/** XP levels earned by `xp`: the largest n whose total cost is covered, at most `xpRoom(base)`. */
export function levelsFor(xp: number, base = 0): number {
  if (!(xp > 0)) return 0;
  const max = xpRoom(base);
  let n = 0;
  while (n < max && xp >= xpForLevels(n + 1)) n++;
  return n;
}

/** Progress within the current level: `xp` into the level and `per` the level's width (both 0 at the cap). */
export function xpProgress(xp: number, base = 0): { xp: number; per: number } {
  const n = levelsFor(xp, base);
  if (n >= xpRoom(base)) return { xp: 0, per: 0 };
  return { xp: Math.floor(xp - xpForLevels(n)), per: xpForLevels(n + 1) - xpForLevels(n) };
}
