import { validateTemplate } from '../shipgen/validate';
import type { ModuleDef } from '../registry';
import { validateAsteroid } from '../asteroids/validate';
import { Struct } from '../structure';
import type { OutpostPlan } from './gen';

/** Ship checks an outpost is exempt from: it does not fly or fight. */
const EXEMPT = ['no engine', 'no helm or AI core'];

/**
 * Problems with an outpost, empty when sound: the base template passes the ship checks (modules on floor, access and chairs
 * clear, every walkable tile reachable, power balance, one connected structure) except the helm and engine, it has an
 * airlock, the asteroid is sound, the airlock's collar opens on space, and (dug) every carved tile is closed in by rock
 * mass or the base's own tiles (no breach to space or ground).
 */
export function validateOutpost(o: OutpostPlan, defs: Record<string, ModuleDef>): string[] {
  const problems = validateTemplate(o.template, defs).filter((p) => !EXEMPT.includes(p));
  problems.push(...validateAsteroid(o.asteroid).map((p) => `asteroid: ${p}`));
  const airlocks = (o.template.modules ?? []).filter((m) => defs[m.def]?.airlock);
  if (airlocks.length === 0) problems.push('no airlock');
  const plan = o.asteroid;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= plan.w || y >= plan.h ? Struct.Space : plan.struct[y * plan.w + x]);
  const cell = (lx: number, ly: number) => o.template.rows[ly]?.[lx] ?? '.';
  for (const a of airlocks) {
    if (at(o.at.x + a.x + 1, o.at.y + a.y - 1) !== Struct.Space) problems.push('airlock collar is not open space');
  }
  if (o.style === 'dug') {
    for (let ly = 0; ly < o.template.rows.length; ly++) {
      for (let lx = 0; lx < (o.template.rows[ly] as string).length; lx++) {
        if (cell(lx, ly) !== '_' && cell(lx, ly) !== 'D') continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (cell(lx + dx, ly + dy) !== '.') continue;
          if (at(o.at.x + lx + dx, o.at.y + ly + dy) !== Struct.Rock) problems.push(`breach at ${lx + dx},${ly + dy}`);
        }
      }
    }
  }
  return problems;
}
