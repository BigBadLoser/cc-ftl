import { mirrorBlock } from './arranger';
import { blockFrom, localBuilder } from './blocks';
import { barge, cockpit, habitat, station, tower } from './civilBlocks';
import { boomRig, containerFrame, oreCage, truss, trussBridge } from './civilFrames';
import { arms, beside, byVariant, civil, cratesOf, crewBlock, frameJoin, join, stern } from './civilKit';
import { jobs, no, type Ctx } from './navyKit';
import type { RoomSpec } from './plan';

/** Civilian freighters and mining ships (see `civilGrammars.ts` for the families' topologies). */

/**
 * Bow rig as one truss block: a cross piece and two to four arms reaching forward from it, lengths even, chevron
 * (outer arms longer) or forked (inner longer). Joins the bow's west wall.
 */
function bowRig(c: Ctx, root: number): boolean {
  const spread = c.rng.int(3, 8);
  const n = c.rng.int(2, Math.min(4, spread));
  const reach = c.rng.int(5, 11);
  const splay = c.rng.pick(['even', 'chevron', 'fork'] as const);
  const lens = Array.from({ length: n }, (_, i) => {
    const outer = Math.abs(i - (n - 1) / 2) / Math.max(1, (n - 1) / 2);
    return Math.max(3, reach + Math.round((splay === 'chevron' ? 3 : splay === 'fork' ? -3 : 0) * (2 * outer - 1)));
  });
  const L = Math.max(...lens);
  const b = localBuilder(c.rng);
  const top = -1 - spread;
  // Cross piece and arms are 3 thick (the footprint width rule).
  truss(b, L, top, 3, 2 * spread + 1, 'cross');
  lens.forEach((len, i) => {
    const t = 3;
    const y = Math.min(top + 2 * spread + 1 - t, top + Math.round((i * (2 * spread + 1 - t)) / Math.max(1, n - 1)));
    truss(b, L - len, y, len, t, `arm${i}`);
  });
  const blk = { ...blockFrom(b, 'beam', 'mining rig', 'external', [{ id: 'e', side: 'e', x: L + 3, y: top, len: 2 * spread + 1, access: 'external' }]), bare: true };
  if (c.A.attach(root, blk, { side: 'w', align: 'mid', doors: 0, kind: 'beam' }) === null) return no(c, 'rig');
  c.parts.push(`bow rig ${n}x${reach} ${splay}`);
  return true;
}

/** Mid-ship rig: a strut out of each flank of a hold, an arm sweeping forward from its tip (sometimes raked aft too). */
function midRig(c: Ctx, host: number): boolean {
  const out = c.rng.int(3, 7);
  const reach = c.rng.int(5, 10);
  const rake = c.rng.chance(0.35) ? c.rng.int(2, 4) : 0;
  const b = localBuilder(c.rng);
  // 3 wide beams (the footprint width rule): the arm's rows are -out-2 .. -out.
  truss(b, reach - 1, -out - 2, 3, out + 2, 'strut');
  truss(b, 0, -out - 2, reach + 2, 3, 'arm');
  if (rake > 0) truss(b, reach + 2, -out - 2, rake, 3, 'rake');
  const blk = { ...blockFrom(b, 'beam', 'mining rig', 'external', [{ id: 's', side: 's', x: reach - 1, y: 0, len: 3, access: 'external' }]), bare: true };
  for (const [side, r] of [['n', blk], ['s', mirrorBlock(blk)]] as const) {
    if (c.A.attach(host, r, { side, align: 'mid', doors: 0, kind: 'beam' }) === null) return no(c, 'mid rig');
  }
  c.parts.push(`mid rig ${out}/${reach}${rake ? ' raked' : ''}`);
  return true;
}

/** Mining (v20 struts, a minority): a cockpit, ore barges in line, the rig fore of the bow or mid-ship. */
export function struts(c: Ctx): boolean {
  const j = jobs(c.plan);
  const bow = civil(cockpit(c.rng, c.plan.command, [...j.core, ...j.crew]), 'command', 'cockpit');
  if (!bow) return no(c, 'cockpit');
  const root = c.A.placeRoot(bow);
  const where = c.rng.pick(['bow', 'bow', 'mid', 'both'] as const);
  if (where !== 'mid' && !bowRig(c, root)) return false;
  const crates = Math.max(6, cratesOf(j.stores));
  const n = c.rng.int(1, Math.max(1, Math.min(3, Math.floor(crates / 5))));
  let host = root;
  const holds: number[] = [];
  for (let i = 0; i < n; i++) {
    const per = Math.ceil(crates / n);
    const h = join(c, host, civil(barge(c.rng, per, c.rng.int(2, Math.max(2, Math.min(4, Math.ceil(per / 2))))), 'cargo', 'ore holds'));
    if (h === null) return no(c, 'holds');
    holds.push(h);
    host = h;
  }
  if (where !== 'bow' && !midRig(c, holds[Math.floor((holds.length - 1) / 2)] as number)) return false;
  c.parts.push(`${where} holds ${n}`);
  return stern(c, host) && arms(c, holds, j.guns);
}


/** A second (third...) pick from the ship's variant draw, decorrelated by `salt`: shared by every candidate arrangement. */
function salted<T extends string>(c: Ctx, salt: number, set: [T, number][]): T {
  const v = ((c.variant ?? c.rng.next()) * salt * 1.618) % 1;
  return byVariant({ ...c, variant: v }, set);
}

export type CrewForm = 'block' | 'tower' | 'wide' | 'slim';

/**
 * The crewed body in a seeded form: the cockpit (bridge, core, airlocks) and the crew rooms as a habitat ring aft
 * (`block`), a bridge tower off one flank (`tower`), a short wide square module aft (`wide`), or all along the cockpit's
 * stub (`slim`). `aft` is the block the drive joins.
 */
function crewBody(c: Ctx): { root: number; aft: number } | null {
  const j = jobs(c.plan);
  const docks = j.crew.filter((r) => r.role === 'dock');
  const crew = j.crew.filter((r) => r.role !== 'dock');
  const form: CrewForm = crew.length === 0 ? 'slim' : salted(c, 7, [['block', 2], ['tower', 2], ['wide', 2], ['slim', 1]]);
  c.parts.push(`crew ${form}`);
  const inWide = form === 'wide' ? crew.slice(0, 3) : [];
  const root = crewBlock(c, [...j.core, ...docks, ...(form === 'slim' ? crew : form === 'wide' ? crew.slice(3) : [])]);
  if (root === null) return null;
  if (form === 'slim') return { root, aft: root };
  if (form === 'tower') {
    const t = civil(tower(c.rng, crew), 'habitat', 'bridge tower');
    if (!t) return null;
    const side = c.rng.chance(0.5) ? 'n' : 's';
    const id = join(c, root, side === 'n' ? t : mirrorBlock(t), side) ?? join(c, root, side === 'n' ? mirrorBlock(t) : t, side === 'n' ? 's' : 'n');
    return id === null ? null : { root, aft: root };
  }
  if (form === 'wide') {
    const m = join(c, root, civil(station(c.rng, inWide), 'habitat', 'crew square'));
    return m === null ? null : { root, aft: m };
  }
  const hub = crew.find((r) => r.role === 'support') ?? (crew[0] as RoomSpec);
  const rest = crew.filter((r) => r !== hub);
  const hab = join(c, root, civil(habitat(c.rng, hub, rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)), 'habitat', 'crew module'));
  return hab === null ? null : { root, aft: hab };
}


/** Container frame options drawn per ship: grid shape, rail count, stacking. */
const frameOpts = (c: Ctx, lane: number): Parameters<typeof containerFrame>[2] => {
  // The usual container: its short (door) end on the spine, always 3x6: the 2x4 box is under the 3-tile width rule.
  const [cw, ch] = [3, 6] as const;
  return frameOptsOf(c, lane, cw, ch);
};
const frameOptsOf = (c: Ctx, lane: number, cw: number, ch: number): Parameters<typeof containerFrame>[2] => ({
  lane, gap: c.rng.int(0, 2), cw, ch, bands: c.rng.chance(0.4) ? 2 : 1, stagger: c.rng.chance(0.3),
  missing: c.rng.pick([0, 0.08, 0.15]),
});

/** Freighter: frame (crew body aft, mid or on the flank), offset bridge, or tug and barge. */
export function freighter(c: Ctx): boolean {
  const j = jobs(c.plan);
  const crates = Math.max(6, cratesOf(j.stores));
  const topo = byVariant(c, [['frame', 3], ['offset', 2], ['tug', 2]] as ['frame' | 'offset' | 'tug', number][]);
  c.parts.push(topo);
  if (topo === 'tug') return tug(c, crates);
  if (topo === 'frame') {
    const pos = salted(c, 13, [['aft', 2], ['mid', 1], ['flank', 1]] as ['aft' | 'mid' | 'flank', number][]);
    c.parts.push(pos);
    if (pos === 'flank') {
      // The frame on the axis, the crew block along its flank (flush aft), the drive on the frame's after end.
      const root = c.A.placeRoot(containerFrame(c.rng, crates * 3, frameOpts(c, c.rng.int(1, 3))));
      const crew = civil(cockpit(c.rng, c.plan.command, [...j.core, ...j.crew]), 'command', 'cockpit');
      const id = crew ? beside(c, root, crew) : null;
      return (id !== null || no(c, 'crew')) && stern(c, root) && arms(c, [id as number], j.guns);
    }
    const body = crewBody(c);
    if (!body) return no(c, 'crew body');
    if (frameJoin(c, body.root, containerFrame(c.rng, crates * (pos === 'mid' ? 2 : 3), frameOpts(c, c.rng.int(0, 3))), 'w') === null) return no(c, 'frame');
    let aft = body.aft;
    if (pos === 'mid') {
      const b2 = frameJoin(c, aft, containerFrame(c.rng, crates * 2, { ...frameOpts(c, c.rng.int(0, 3)), crawl: true }), 'e');
      if (b2 === null) return no(c, 'aft frame');
      aft = b2;
    }
    return stern(c, aft) && arms(c, [body.root, body.aft], j.guns);
  }
  const body = crewBody(c);
  if (!body) return no(c, 'crew body');
  if (!stern(c, body.aft)) return false;
  // The cargo mass: containers packed back to back, one or two bands.
  const mass = containerFrame(c.rng, crates * 3, frameOpts(c, 0));
  return (beside(c, body.aft, mass) !== null || no(c, 'cargo mass')) && arms(c, [body.root, body.aft], j.guns);
}

/**
 * Tug and barge: a small, narrow tug (bridge, core and airlocks on a short stub, the drive) pushing a much bigger
 * container barge on an open truss; the crew quarters ride a habitat at the barge's far end.
 */
function tug(c: Ctx, crates: number): boolean {
  const j = jobs(c.plan);
  // The tug carries only the bridge and core; quarters and airlocks ride the barge's habitat.
  const crew = [...j.crew.filter((r) => r.role !== 'dock'), ...j.crew.filter((r) => r.role === 'dock')];
  const root = crewBlock(c, j.core);
  if (root === null) return no(c, 'tug');
  if (!stern(c, root)) return false;
  const t = frameJoin(c, root, trussBridge(c.rng, c.rng.int(10, 16), 2), 'w');
  const o = { ...frameOptsOf(c, c.rng.int(0, 2), 3, 6), bands: 2, crawl: true };
  const barge = t === null ? null : frameJoin(c, t, containerFrame(c.rng, crates * 5, o), 'w');
  if (barge === null) return no(c, 'barge');
  if (crew.length > 0) {
    const hub = crew.find((r) => r.role === 'support') ?? (crew[0] as RoomSpec);
    const rest = crew.filter((r) => r !== hub);
    if (join(c, barge, civil(habitat(c.rng, hub, rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)), 'habitat', 'barge quarters'), 'w') === null) return no(c, 'quarters');
  }
  return arms(c, [root, barge], j.guns);
}


/** Mining: ore cages beside the crew body (one flank or both), the rig on a long offset boom, or v20's struts. */
export function mining(c: Ctx): boolean {
  const topo = byVariant(c, [['cage', 3], ['boom', 3], ['struts', 1]] as ['cage' | 'boom' | 'struts', number][]);
  c.parts.push(topo);
  if (topo === 'struts') return struts(c);
  const j = jobs(c.plan);
  const crates = Math.max(6, cratesOf(j.stores));
  const body = crewBody(c);
  if (!body) return no(c, 'crew body');
  const { root, aft } = body;
  // Cages hang flush aft beside the crew body, as long as fits alongside it (never past the drive).
  const o = { hw: c.rng.int(2, 4), hh: c.rng.int(3, 4), gap: c.rng.pick([1, 3, 3, 4]), every: c.rng.int(1, 2), tooth: c.rng.int(1, 4) };
  const sides = topo === 'cage' && c.rng.chance(0.4) ? 2 : 1;
  for (let s = 0; s < sides; s++) {
    let cage: number | null = null;
    // Start from the most holds that fit alongside the crew body, shrink until one hangs.
    const span = (c.A.placed[aft]?.x ?? 0) + (c.A.placed[aft]?.block.rows[0]?.length ?? 0) - (c.A.placed[root]?.x ?? 0);
    const most = Math.max(2, Math.min(12, Math.floor((span + o.gap) / (o.hw + 2 + o.gap))));
    for (let k = most; k >= 2 && cage === null; k--) cage = beside(c, aft, oreCage(c.rng, crates * (4 - sides), o, k), true);
    if (cage === null) return no(c, 'cage');
  }
  c.parts.push(`cages ${sides}`);
  if (!stern(c, aft)) return false;
  if (topo === 'cage') {
    if (c.rng.chance(0.5) && !bowRig(c, root)) return false;
    return arms(c, [root, aft], j.guns);
  }
  // Boom: the rig on a long boom off the free flank, reaching past the bow.
  const spread = c.rng.int(3, 5);
  const len = c.rng.int(10, 18);
  const armsN = c.rng.int(2, 3);
  const reach = c.rng.int(4, 8);
  for (let out = c.rng.int(2, 4); out < 12; out += 2) {
    const blk = boomRig(c.rng, out, len, spread, armsN, reach);
    for (const side of ['n', 's'] as const) {
      if (c.A.attach(root, side === 'n' ? blk : mirrorBlock(blk), { side, align: 'start', doors: 0, kind: 'beam' }) !== null) {
        c.parts.push(`boom ${len}/${out}`);
        return arms(c, [root, aft], j.guns);
      }
    }
  }
  return no(c, 'boom');
}

