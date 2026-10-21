import { structureParts } from '../shipgen/validate';
import { isRock, Struct } from '../structure';
import { FIELD } from './gen';
import type { AsteroidPlan } from './types';

/** The struct cells of `plan` inside rect (x, y, w, h) as shipgen cells ('.' space, '#' rock), for `structureParts`. */
function cells(plan: AsteroidPlan, x0: number, y0: number, w: number, h: number): string[] {
  const out: string[] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push(isRock(plan.struct[y * plan.w + x] as number) ? '#' : '.');
  return out;
}

/**
 * Problems with a generated asteroid, empty when sound: each part is one 4-connected rock body (a big asteroid has one part),
 * every rock tile lies in a part, ore sits only on plain rock with an amount, the core (if any) is one connected body of
 * CoreRock inside the asteroid, and field rocks keep `FIELD.gap` between their bboxes.
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
      if (isRock(k) && !plan.parts.some((p) => x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h)) stray++;
      if (plan.ore[i] !== 0 && (k !== Struct.Rock || plan.amt[i] === 0)) badOre++;
      if (plan.ore[i] === 0 && plan.amt[i] !== 0) badOre++;
    }
  }
  if (stray) problems.push(`${stray} rock tiles outside every part`);
  if (badOre) problems.push(`${badOre} tiles with ore off plain rock or without an amount`);
  if (plan.hollow && plan.kind === 'big') {
    const coreCells = Array.from(plan.struct, (k) => (k === Struct.CoreRock ? '#' : '.'));
    const n = structureParts(coreCells, plan.w, plan.h);
    if (n > 1) problems.push(`core has ${n} bodies`);
  } else if (plan.struct.some((k) => k === Struct.CoreRock)) problems.push('core rock on a solid asteroid');
  for (let a = 0; a < plan.parts.length; a++) {
    for (let b = a + 1; b < plan.parts.length; b++) {
      const p = plan.parts[a] as AsteroidPlan['parts'][number], q = plan.parts[b] as AsteroidPlan['parts'][number];
      const g = FIELD.gap;
      if (p.x < q.x + q.w + g && q.x < p.x + p.w + g && p.y < q.y + q.h + g && q.y < p.y + p.h + g) problems.push(`parts ${a} and ${b} closer than ${g}`);
    }
  }
  return problems;
}
