import { XP_LEVEL_COST, XP_MAX_LEVEL } from '../tuning';

/** Total XP needed for `levels` XP levels (docs/TRAITS.md section 3): XP_LEVEL_COST x n^2. */
export function xpForLevels(levels: number): number {
  return XP_LEVEL_COST * levels * levels;
}

/** XP levels earned by `xp`: the largest n whose total cost is covered, at most XP_MAX_LEVEL. */
export function levelsFor(xp: number): number {
  if (!(xp > 0)) return 0;
  return Math.min(XP_MAX_LEVEL, Math.floor(Math.sqrt(xp / XP_LEVEL_COST)));
}

/** Progress within the current level: `xp` into the level and `per` the level's width (both 0 at the cap). */
export function xpProgress(xp: number): { xp: number; per: number } {
  const n = levelsFor(xp);
  if (n >= XP_MAX_LEVEL) return { xp: 0, per: 0 };
  return { xp: Math.floor(xp - xpForLevels(n)), per: xpForLevels(n + 1) - xpForLevels(n) };
}
