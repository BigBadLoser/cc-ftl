import { Arranger } from './arranger';
import { fillHoles, holes, taper } from './hullFill';
import { Builder } from './builder';
import { CIVIL_GRAMMARS } from './civilGrammars';
import { DRONE_GRAMMARS } from './droneGrammars';
import { SCRAP_GRAMMARS } from './scrapGrammars';
import { STATION_GRAMMARS } from './stationGrammars';
import { GRAMMARS as NAVY } from './navyGrammars';
import type { ModuleDef } from '../registry';
import type { Ctx } from './navyKit';
import { pickWeighted, type ShipPlan } from './plan';
import type { Rng } from '../rng';
import type { FactionDef, HullFamilyDef, SectionKind } from './types';

/**
 * Hull arrangement (any faction with hull families): draw a grammar of the family, try a few candidate arrangements of it (each with its own seeded
 * depths, slides and propulsion), then keep the one that best fits the family's soft proportion target and compactness. Proportions are scoring pressure,
 * never a hard reject.
 */

const CANDIDATES = 6;

/** Plans are mutated by grammars (the nose takes a gun, pods take engines): each candidate gets its own copy. */
const clonePlan = (p: ShipPlan): ShipPlan => JSON.parse(JSON.stringify(p)) as ShipPlan;

function score(A: Arranger, fam: HullFamilyDef, noise: number): number {
  const s = A.stats();
  const aspect = s.w / s.h;
  const [lo, hi] = fam.aspect;
  const off = aspect < lo ? lo / aspect - 1 : aspect > hi ? aspect / hi - 1 : 0;
  // Enclosed courtyards read as mistakes: open them or fill them.
  return -3 * off + (s.filled / (s.w * s.h)) - (8 * holes(A)) / s.filled + noise;
}

// Built on first use: scrapper grammars call back into arrangeHull for their navy and drone donors.
let GRAMMARS: Record<string, (c: Ctx, f: FactionDef) => boolean> | null = null;

export function arrangeHull(
  rng: Rng, f: FactionDef, fam: HullFamilyDef, plan: ShipPlan, defs: Record<string, ModuleDef>, candidates = CANDIDATES,
): { b: Builder; A: Arranger; profile: string; plan: ShipPlan } | string {
  let best: { A: Arranger; c: Ctx; s: number } | null = null;
  let why = '';
  // The grammar is drawn once (the family's architectural mix stays as weighted); proportion pressure then chooses
  // between candidate arrangements of that grammar, falling back to any grammar if none fits.
  const first = pickWeighted(rng, fam.grammars);
  const variant = rng.next();
  for (let k = 0; k < candidates + 2; k++) {
    if (k >= candidates && best) break;
    const depth: Partial<Record<SectionKind, number>> = {};
    for (const kind of Object.keys(fam.depth) as SectionKind[]) {
      const r = fam.depth[kind] as readonly [number, number];
      depth[kind] = rng.int(r[0], r[1]);
    }
    const grammar = k < candidates ? first : pickWeighted(rng, fam.grammars);
    const A = new Arranger(() => rng.next(), -1);
    const c: Ctx = { rng, fam, plan: clonePlan(plan), A, depth, parts: [grammar], why: '', defs, variant };
    GRAMMARS ??= { ...NAVY, ...DRONE_GRAMMARS, ...SCRAP_GRAMMARS, ...CIVIL_GRAMMARS, ...STATION_GRAMMARS };
    const run = GRAMMARS[grammar];
    if (!run || !run(c, f)) { why ||= `${grammar}: ${c.why || 'no fit'}`; continue; }
    const s = score(A, fam, rng.next() * 0.6);
    if (!best || s > best.s) best = { A, c, s };
  }
  if (!best) return why || 'no feasible arrangement';
  // Small enclosed pockets (between a drive and a deck end, between welded hulls) are plated over.
  // Transitions in the faction's style where sections of different widths meet, then small pockets plated over.
  if (f.transition && taper(best.A, f.transition, () => rng.next()) > 0) best.c.parts.push('tapered');
  if (fillHoles(best.A, 16) > 0) best.c.parts.push('filled');
  const b = new Builder(rng, -1);
  best.A.stamp(b);
  return { b, A: best.A, profile: best.c.parts.join(' '), plan: best.c.plan };
}
