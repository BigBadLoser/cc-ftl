import { mirrorBlock, mirrorX, type Block, type Side } from './arranger';
import { blockFrom, hallBlock, localBuilder } from './blocks';
import { drive } from './civilBlocks';
import { truss } from './civilFrames';
import { freeze } from './salvage';
import type { Rng } from '../rng';
import { plate } from './hullFill';
import { storeRoom } from './droneBlocks';
import { dockBlock, podBlock } from './navyBlocks';
import { no, type Ctx } from './navyKit';
import { pickWeighted, shuffle } from './plan';
import { DONORS, leftovers, poolOf, clonePool, restorePool, type Need, type Pool } from './scrapDonors';
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

/** Donors for this ship: the anchor, one per job nobody carries yet, then extras the role likes. */
function choose(c: Ctx): DonorKind[] {
  const w = c.fam.donors ?? {};
  const kinds = Object.keys(w) as DonorKind[];
  const anchor = c.fam.anchors && c.fam.anchors.length > 0 ? pickWeighted(c.rng, c.fam.anchors) : 'freighter';
  const out: DonorKind[] = [anchor];
  for (const need of NEEDS) {
    if (need === 'hangar' && c.plan.hangars.length === 0) continue;
    if (out.some((k) => DONORS[k].serves.includes(need))) continue;
    const opts = kinds.filter((k) => DONORS[k].serves.includes(need) && (w[k] ?? 0) > 0);
    if (opts.length > 0) out.push(pickWeighted(c.rng, opts.map((k) => ({ value: k, weight: w[k] ?? 0 }))));
  }
  for (let n = c.rng.int(0, Math.floor((c.plan.size + 1) / 2)); n > 0; n--) {
    const opts = kinds.filter((k) => (w[k] ?? 0) > 0 && out.filter((x) => x === k).length < 2 && !['navyBow', 'tug', 'navyDrive'].includes(k));
    if (opts.length > 0) out.push(pickWeighted(c.rng, opts.map((k) => ({ value: k, weight: w[k] ?? 0 }))));
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

/**
 * A scrap strut: a crawl tube with a truss chord along it, `len` long, bridging two donors so each keeps its outline (a
 * visible seam between them, never a merged mass).
 */
function strut(rng: Rng, len: number, horiz: boolean): Block {
  const b = localBuilder(rng);
  if (horiz) {
    b.place({ x: 0, y: -2, w: len + 2, h: 3 }, 'hall');
    truss(b, 1, rng.chance(0.5) ? -3 : 1, len, 1, 'chord');
  } else {
    b.place({ x: -2, y: 0, w: 3, h: len + 2 }, 'hall');
    truss(b, rng.chance(0.5) ? -3 : 1, 1, 1, len, 'chord');
  }
  const ports = horiz
    ? [{ id: 'w', side: 'w' as const, x: 0, y: -1, len: 1, access: 'human' as const }, { id: 'e', side: 'e' as const, x: len + 1, y: -1, len: 1, access: 'human' as const }]
    : [{ id: 'n', side: 'n' as const, x: -1, y: 0, len: 1, access: 'human' as const }, { id: 's', side: 's' as const, x: -1, y: len + 1, len: 1, access: 'human' as const }];
  return { ...blockFrom(b, 'beam', 'strut', 'human', ports), donor: 'scrap', label: 'scrap: strut', bare: true };
}

/** Weld `child` onto `host` through a strut on `side`. */
function strutWeld(c: Ctx, h: number, v: Block, side: Side): number | null {
  const s = c.A.attach(h, strut(c.rng, c.rng.int(3, 4 + c.plan.size), side === 'e' || side === 'w'), { side, align: 'any', kind: 'graft' });
  if (s === null) return null;
  const id = c.A.attach(s, v, { side, align: 'mid', kind: 'graft' }) ?? c.A.attach(s, v, { side, align: 'any', kind: 'graft' });
  if (id === null) c.A.undoLast();
  else c.parts.push('strut');
  return id;
}

/**
 * Weld `child` onto one of `hosts` (in order) on one of `sides`. Most donors hang off struts (each keeps its outline);
 * some weld flush (the ragged adapters fill those seams); a short scrap tube is the last resort.
 */
function weld(c: Ctx, hosts: number[], child: Block, sides: Side[], align: 'any' | 'start' | 'end' = 'any'): number | null {
  const vs = variants(c, child);
  if (!child.label.startsWith('scrap') && c.rng.chance(0.85)) {
    // A few tries only: a failed strut is undone, and undoing rebuilds the arrangement.
    let tries = 8;
    for (const h of hosts) for (const side of sides) for (const v of vs) {
      if (tries <= 0 || !v.ports.some((p) => p.side === OPP[side])) continue;
      tries--;
      const id = strutWeld(c, h, v, side);
      if (id !== null) return id;
    }
  }
  for (const tube of [false, true]) {
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
    // A strapped engine: a nozzle on a stub of spine (the light civil drive's smallest form), not a bare slab.
    const nb = drive(c.rng, 1, 0, 'nozzle');
    const pod = nb ? { ...freeze(nb, 'drive', 'strapped engine', 'scrap'), label: 'scrap: strapped engine' } : { ...podBlock(c.rng, 1), donor: 'scrap', label: 'scrap: strapped engine' };
    if (weld(c, shuffle(c.rng, hostsOf(c)), pod, ['n', 's']) === null) return no(c, 'strapped engine');
    c.parts.push('strapped engine');
  }
  for (let k = 0; k < 3 && p.crates > 0; k++) {
    const n = Math.min(3, p.crates);
    if (weld(c, shuffle(c.rng, hostsOf(c)), { ...storeRoom(c.rng, n), donor: 'scrap', label: 'scrap: crates' }, ['n', 's', 'w']) !== null) p.crates -= n;
  }
  for (; p.docks > 0; p.docks--) weld(c, shuffle(c.rng, hostsOf(c)), { ...dockBlock(c.rng), donor: 'scrap', label: 'scrap: airlock' }, ['n', 's']);
  // Plate only hairline seams: wider gaps are the struts' daylight, and keep the donors apart.
  if (plate(c.A, 1) > 0) c.parts.push('plates');
  return true;
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
    id ??= weld(c, all, b, sides);
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
