import { validateTemplate } from '../shipgen/validate';
import type { ModuleDef } from '../registry';
import { validateAsteroid } from '../asteroids/validate';
import { airlockOutside } from './site';
import { Struct } from '../structure';
import type { OutpostPlan } from './gen';

/** Ship checks a carved (dug) base is exempt from: its outer walls are the rock, not hull. */
const DUG_EXEMPT = /not on the hull/;

/**
 * Problems with an outpost, empty when sound: the station template passes the ship checks (immobile: modules on floor, access and
 * chairs clear, power balance, one connected structure; a dug base's airlock walls excepted), it has crew and an airlock, the
 * asteroid is sound, the dock's collar opens on space, no airlock opens into rock mass (a dug base has only its dock), and (dug) every carved tile is closed in by rock mass or the base's own
 * tiles (no breach to space or ground).
 */
export function validateOutpost(o: OutpostPlan, defs: Record<string, ModuleDef>): string[] {
  const problems = validateTemplate(o.template, defs, { immobile: true }).filter((p) => o.style === 'surface' || !DUG_EXEMPT.test(p));
  problems.push(...validateAsteroid(o.asteroid).map((p) => `asteroid: ${p}`));
  if (!(o.template.modules ?? []).some((m) => defs[m.def]?.airlock)) problems.push('no airlock');
  if ((o.template.crew ?? []).length === 0) problems.push('no crew');
  const plan = o.asteroid;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= plan.w || y >= plan.h ? Struct.Space : plan.struct[y * plan.w + x]);
  const cell = (lx: number, ly: number) => o.template.rows[ly]?.[lx] ?? '.';
  const airlocks = (o.template.modules ?? []).filter((m) => defs[m.def]?.airlock);
  if (o.style === 'dug' && airlocks.length !== 1) problems.push(`a dug base keeps only its dock airlock, has ${airlocks.length}`);
  for (const m of airlocks) {
    const out = airlockOutside(defs[m.def] as ModuleDef, m);
    if (at(o.at.x + out.x, o.at.y + out.y) === Struct.Rock) problems.push(`airlock at ${m.x},${m.y} opens into rock`);
  }
  if (at(o.at.x + o.dock.collar.x, o.at.y + o.dock.collar.y) !== Struct.Space) problems.push('airlock collar is not open space');
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
