import { mirrorBlock, mirrorX, type Block, type Side } from './arranger';
import { hallBlock } from './blocks';
import { buried, plate } from './hullFill';
import { storeRoom } from './droneBlocks';
import { dockBlock } from './navyBlocks';
import { strappedEngine } from './scrapBlocks';
import { no, type Ctx } from './navyKit';
import { pickWeighted, shuffle } from './plan';
import { DONORS, leftovers, poolOf, clonePool, restorePool, smallness, type Need, type Pool } from './scrapDonors';
import type { DonorKind, FactionDef, ScrapGrammar } from './types';

/**
 * Scrapper composition on the shared 2D arranger: an anchor donor, the donors this role needs (chosen by job, weighted
 * by the family), grafted wall to wall where they fit. How they are placed is the grammar:
 *   heap   each donor welded to any part already aboard, on any face
 *   raft   the first two donors welded lengthways, the rest heaped on
 *   chain  donors welded end to end, each onto the last, sideways only when the line is blocked
 * Donors may flip top to bottom; engine-free, non-navy donors may also flip end to end (engines always face +x, navy
 * sections keep their bow forward). Seams the welds leave are plated over.
 */

const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
const NEEDS: Need[] = ['command', 'hangar', 'crew', 'guns', 'crates', 'drive'];

/**
 * Donors for this ship: the anchor, one per job nobody carries yet, then extras the role likes. Small ships lean on
 * light donors and on donors that carry several of the open jobs at once, and take fewer extras, so they need fewer
 * and smaller pieces.
 */
function choose(c: Ctx): DonorKind[] {
  const w = c.fam.donors ?? {};
  const kinds = Object.keys(w) as DonorKind[];
  const s = smallness(c.plan);
  const light = (k: DonorKind): number => DONORS[k].small ** s;
  const anchors = c.fam.anchors?.map((a) => ({ value: a.value, weight: a.weight * light(a.value) }));
  const anchor = anchors && anchors.length > 0 ? pickWeighted(c.rng, anchors) : 'freighter';
  const out: DonorKind[] = [anchor];
  const open = (need: Need): boolean => !(need === 'hangar' && c.plan.hangars.length === 0) && !out.some((k) => DONORS[k].serves.includes(need));
  for (const need of NEEDS) {
    if (!open(need)) continue;
    const opts = kinds.filter((k) => DONORS[k].serves.includes(need) && (w[k] ?? 0) > 0);
    const carry = (k: DonorKind): number => 1 + s * (DONORS[k].serves.filter(open).length - 1);
    if (opts.length > 0) out.push(pickWeighted(c.rng, opts.map((k) => ({ value: k, weight: (w[k] ?? 0) * light(k) * carry(k) }))));
  }
  // The smallest ships take at most one extra, and only a light one (pod string, liner segment, drone guns).
  const n0 = c.rng.int(0, 1 + Math.floor(c.plan.size / 2));
  const tiny = s > 0.5;
  for (let n = tiny ? Math.min(1, n0) : Math.floor(n0 * (1 - s)); n > 0; n--) {
    const opts = kinds.filter((k) => (w[k] ?? 0) > 0 && out.filter((x) => x === k).length < 2 && !['navyBow', 'tug', 'navyDrive'].includes(k)
      && (!tiny || (DONORS[k].small > 1 && !DONORS[k].serves.includes('command'))));
    if (opts.length > 0) out.push(pickWeighted(c.rng, opts.map((k) => ({ value: k, weight: (w[k] ?? 0) * light(k) }))));
  }
  return out;
}

/** Build the chosen donors in order, each taking its share of the jobs; then patch in whatever is left. */
function build(c: Ctx, f: FactionDef, kinds: DonorKind[], p: Pool): Block[] {
  for (const k of kinds) for (const n of DONORS[k].serves) p.share[n] = (p.share[n] ?? 0) + 1;
  const cmd = kinds.filter((k) => DONORS[k].serves.includes('command'));
  p.commandBy = cmd.includes('navyBow') ? 'navyBow' : cmd.length > 0 ? c.rng.pick(cmd) : null;
  const out: Block[] = [];
  for (const k of kinds) {
    const save = clonePool(p);
    const b = DONORS[k].build(c, f, p);
    if (!b) restorePool(p, save);
    else out.push(b);
    for (const n of DONORS[k].serves) p.share[n] = Math.max(0, (p.share[n] ?? 1) - 1);
  }
  return [...out, ...leftovers(c, f, p)];
}

/** Ways a donor may be turned: flipped top to bottom always, end to end only when nothing in it is directional. */
function variants(c: Ctx, b: Block): Block[] {
  const v = [b, mirrorBlock(b)];
  if (b.faceE.length === 0 && b.donor !== 'navy') v.push(mirrorX(b), mirrorX(mirrorBlock(b)));
  return shuffle(c.rng, v);
}

/** Weld `child` onto one of `hosts` (in order) on one of `sides`: flush first, then through a short scrap tube (or tube first). */
function weld(c: Ctx, hosts: number[], child: Block, sides: Side[], align: 'any' | 'start' | 'end' = 'any', tubeFirst = false): number | null {
  const vs = variants(c, child);
  for (const tube of tubeFirst ? [true, false] : [false, true]) {
    for (const h of hosts) {
      for (const side of sides) {
        for (const v of vs) {
          if (!v.ports.some((p) => p.side === OPP[side])) continue;
          if (!tube) {
            const id = c.A.attach(h, v, { side, align, kind: 'graft' });
            if (id !== null) return id;
            continue;
          }
          const t = hallBlock(c.rng, c.rng.int(1, 3), c.rng.int(1, 2), side === 'e' || side === 'w', 'human');
          const tid = c.A.attach(h, { ...t, donor: 'scrap', label: 'scrap: tube' }, { side, align: 'any', kind: 'graft' });
          if (tid === null) continue;
          const id = c.A.attach(tid, v, { side, align: 'mid', kind: 'graft' });
          if (id !== null) { c.parts.push('tube'); return id; }
          c.A.undoLast();
        }
      }
    }
  }
  return null;
}

const hostsOf = (c: Ctx): number[] => c.A.placed.map((_, i) => i).filter((i) => c.A.placed[i]?.block.kind !== 'plate');

/** Strap the extra engines on as pods, bolt on crates and airlocks, plate the seams. */
function improvise(c: Ctx, p: Pool): boolean {
  for (; p.engines > 0; p.engines--) {
    const pod = { ...strappedEngine(c.rng), donor: 'scrap', label: 'scrap: strapped engine' };
    if (weld(c, shuffle(c.rng, hostsOf(c)), pod, ['n', 's']) === null) return no(c, 'strapped engine');
    c.parts.push('strapped engine');
  }
  for (let k = 0; k < 3 && p.crates > 0; k++) {
    const n = Math.min(3, p.crates);
    if (weld(c, shuffle(c.rng, hostsOf(c)), { ...storeRoom(c.rng, n), donor: 'scrap', label: 'scrap: crates' }, ['n', 's', 'w']) !== null) p.crates -= n;
  }
  for (; p.docks > 0; p.docks--) weld(c, shuffle(c.rng, hostsOf(c)), { ...dockBlock(c.rng), donor: 'scrap', label: 'scrap: airlock' }, ['n', 's']);
  if (plate(c.A, 2) > 0) c.parts.push('plates');
  // Welds wrapping round a gun or airlock can wall its kept-open face into a sealed pocket: no use, try another.
  return !buried(c.A) || no(c, 'buried face');
}

/** Compose: build the donors, place the anchor, weld the rest on as the grammar says. */
function compose(c: Ctx, f: FactionDef, mode: ScrapGrammar): boolean {
  const p = poolOf(c.plan);
  const blocks = build(c, f, choose(c), p);
  const [anchor, ...rest] = blocks;
  if (!anchor) return no(c, 'donors');
  c.A.placeRoot(anchor);
  c.parts.push(mode, anchor.label);
  // Drives last, so nothing has to keep clear of their exhaust while it is placed.
  const order = [...shuffle(c.rng, rest.filter((b) => b.faceE.length === 0)), ...rest.filter((b) => b.faceE.length > 0)];
  let last = 0;
  for (const [i, b] of order.entries()) {
    const all = shuffle(c.rng, hostsOf(c));
    const sides = shuffle(c.rng, ['n', 's', 'e', 'w'] as Side[]);
    let id: number | null = null;
    if (mode === 'raft' && i === 0) id = weld(c, [0], b, shuffle(c.rng, ['n', 's'] as Side[]), c.rng.pick(['start', 'end'] as const));
    else if (mode === 'chain') id = weld(c, [last, ...all.filter((h) => h !== last)], b, [...shuffle(c.rng, ['e', 'w'] as Side[]), 'n', 's']);
    // Big heaps would merge into one blob: from the third donor on, half of them hang off a short scrap tube.
    id ??= weld(c, all, b, sides, 'any', mode === 'heap' && i >= 2 && c.rng.chance(0.5));
    if (id === null) return no(c, `weld ${b.label}`);
    last = id;
    c.parts.push(b.label);
  }
  return improvise(c, p);
}

export const SCRAP_GRAMMARS: Record<ScrapGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  heap: (c, f) => compose(c, f, 'heap'),
  raft: (c, f) => compose(c, f, 'raft'),
  chain: (c, f) => compose(c, f, 'chain'),
};
