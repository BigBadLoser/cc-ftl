import { structureParts } from '../shipgen/validate';
import { isAsteroidRock, Struct } from '../structure';
import { FIELD } from './gen';
import type { AsteroidPlan } from './types';

/** The struct cells of `plan` inside rect (x, y, w, h) as shipgen cells ('.' space, '#' rock), for `structureParts`. */
function cells(plan: AsteroidPlan, x0: number, y0: number, w: number, h: number): string[] {
  const out: string[] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push(isAsteroidRock(plan.struct[y * plan.w + x] as number) ? '#' : '.');
  return out;
}

/**
 * Problems with a generated asteroid, empty when sound: each part is one 4-connected rock body (a big asteroid has one part),
 * every rock tile (mass or ground) lies in a part, ore sits only on rock with an amount, the recorded mass share matches the
 * tiles, and field rocks keep `FIELD.gap` between their bboxes.
 */
export function validateAsteroid(plan: AsteroidPlan): string[] {
  const problems: string[] = [];
  if (plan.kind === 'big' && plan.parts.length !== 1) problems.push(`big asteroid has ${plan.parts.length} parts`);
  if (plan.parts.length === 0) problems.push('no rock');
  for (const [k, p] of plan.parts.entries()) {
    const n = structureParts(cells(plan, p.x, p.y, p.w, p.h), p.w, p.h);
    if (n !== 1) problems.push(`part ${k} has ${n} bodies`);
  }
  if (plan.kind === 'big' && structureParts(cells(plan, 0, 0, plan.w, plan.h), plan.w, plan.h) !== 1) problems.push('rock is not one body');
  let stray = 0;
  let badOre = 0;
  for (let y = 0; y < plan.h; y++) {
    for (let x = 0; x < plan.w; x++) {
      const i = y * plan.w + x;
      const k = plan.struct[i] as number;
      if (isAsteroidRock(k) && !plan.parts.some((p) => x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h)) stray++;
      if (plan.ore[i] !== 0 && (!isAsteroidRock(k) || plan.amt[i] === 0)) badOre++;
      if (plan.ore[i] === 0 && plan.amt[i] !== 0) badOre++;
    }
  }
  if (stray) problems.push(`${stray} rock tiles outside every part`);
  if (badOre) problems.push(`${badOre} tiles with ore off plain rock or without an amount`);
  const solid = plan.struct.filter((k) => k === Struct.Rock).length;
  const rock = plan.struct.filter((k) => isAsteroidRock(k)).length;
  if (rock > 0 && Math.abs(solid / rock - plan.mass) > 1e-9) problems.push(`mass share ${solid / rock} is not the recorded ${plan.mass}`);
  for (let a = 0; a < plan.parts.length; a++) {
    for (let b = a + 1; b < plan.parts.length; b++) {
      const p = plan.parts[a] as AsteroidPlan['parts'][number], q = plan.parts[b] as AsteroidPlan['parts'][number];
      const g = FIELD.gap;
      if (p.x < q.x + q.w + g && q.x < p.x + p.w + g && p.y < q.y + q.h + g && q.y < p.y + p.h + g) problems.push(`parts ${a} and ${b} closer than ${g}`);
    }
  }
  return problems;
}
