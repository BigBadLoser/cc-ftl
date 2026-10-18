import { Arranger } from './arranger';
import { Builder } from './builder';
import { GRAMMARS } from './navyGrammars';
import type { Ctx } from './navyKit';
import { pickWeighted, type ShipPlan } from './plan';
import type { Rng } from '../rng';
import type { FactionDef, HullFamilyDef, SectionKind } from './types';

/**
 * Navy arrangement: draw a grammar of the family, try a few candidate arrangements of it (each with its own seeded
 * depths, slides and propulsion), then keep the one that best fits the family's soft proportion target and compactness. Proportions are scoring pressure,
 * never a hard reject.
 */

const CANDIDATES = 4;

/** Plans are mutated by grammars (the nose takes a gun, pods take engines): each candidate gets its own copy. */
const clonePlan = (p: ShipPlan): ShipPlan => JSON.parse(JSON.stringify(p)) as ShipPlan;

function score(A: Arranger, fam: HullFamilyDef, noise: number): number {
  const s = A.stats();
  const aspect = s.w / s.h;
  const [lo, hi] = fam.aspect;
  const off = aspect < lo ? lo / aspect - 1 : aspect > hi ? aspect / hi - 1 : 0;
  return -3 * off + (s.filled / (s.w * s.h)) + noise;
}

export function arrangeNavy(rng: Rng, f: FactionDef, fam: HullFamilyDef, plan: ShipPlan): { b: Builder; A: Arranger; profile: string; plan: ShipPlan } | string {
  let best: { A: Arranger; c: Ctx; s: number } | null = null;
  let why = '';
  // The grammar is drawn once (the family's architectural mix stays as weighted); proportion pressure then chooses
  // between candidate arrangements of that grammar, falling back to any grammar if none fits.
  const first = pickWeighted(rng, fam.grammars);
  for (let k = 0; k < CANDIDATES + 2; k++) {
    if (k >= CANDIDATES && best) break;
    const depth: Partial<Record<SectionKind, number>> = {};
    for (const kind of Object.keys(fam.depth) as SectionKind[]) {
      const r = fam.depth[kind] as readonly [number, number];
      depth[kind] = rng.int(r[0], r[1]);
    }
    const grammar = k < CANDIDATES ? first : pickWeighted(rng, fam.grammars);
    const A = new Arranger(() => rng.next(), -1);
    const c: Ctx = { rng, fam, plan: clonePlan(plan), A, depth, parts: [grammar], why: '' };
    if (!GRAMMARS[grammar](c, f)) { why ||= `${grammar}: ${c.why || 'no fit'}`; continue; }
    const s = score(A, fam, rng.next() * 0.6);
    if (!best || s > best.s) best = { A, c, s };
  }
  if (!best) return why || 'no feasible arrangement';
  const b = new Builder(rng, -1);
  best.A.stamp(b);
  return { b, A: best.A, profile: best.c.parts.join(' '), plan: best.c.plan };
}
