import { SkillXpC } from '../story/components';
import type { SkillName } from '../registry';
import type { Sim } from '../sim';
import { CrewC } from './components';
import { xpGainMult } from './traits';

export { levelsFor, xpForLevels, xpProgress } from './xpCurve';

/**
 * Give a crew member skill XP (docs/TRAITS.md section 3). A module function like `stat`, called where the work is done. Positive
 * amounts are multiplied by the crew member's XP traits (Gifted); a negative amount (a story penalty) is taken as is, down to 0.
 * Any crew member can learn (robots keep their role skills as a base and learn on top); no-op for non-crew.
 */
export function grantXp(sim: Sim, id: number, skill: SkillName, xp: number): void {
  if (xp === 0 || !Number.isFinite(xp)) return;
  const crew = sim.world.get(id, CrewC);
  if (!crew || !sim.content.species[crew.species]) return;
  let c = sim.world.get(id, SkillXpC);
  if (!c) sim.world.add(id, SkillXpC, (c = { xp: {} }));
  const next = (c.xp[skill] ?? 0) + (xp > 0 ? xp * xpGainMult(sim, id, skill) : xp);
  c.xp[skill] = Math.max(0, next);
}
