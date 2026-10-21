import { mirrorBlock, type Block, type Side } from './arranger';
import { hallBlock } from './blocks';
import { podString } from './civilBlocks';
import { oreCage } from './civilFrames';
import { latticeStation, ringStation } from './civilStations';
import { blockOf, civil, shuffle } from './civilKit';
import { no, type Ctx } from './navyKit';
import { allRooms, type RoomSpec } from './plan';
import type { Rng } from '../rng';
import type { FactionDef } from './types';

/**
 * Station topologies on the shared arranger, built from the civil ring and lattice stations (`civilStations.ts`) with
 * no thrusters. Every room of the plan (guns are floor bays under roof turrets) goes inside the structure:
 *   stationRing     one ring round an empty centre, the control room on its hub
 *   stationLattice  modules on a grid linked by tubes and beams
 *   stationHub      a core ring with two to four satellite rings or lattices on long spoke corridors (system hubs)
 *   stationWelded   a small core with modules and loot pods welded straight onto it, no spokes (pirate dens)
 */

/** Every room except the control room (which the ring hub or the first lattice module takes). */
const roomsOf = (c: Ctx): RoomSpec[] => allRooms(c.plan).filter((r) => r !== c.plan.command);
/** Rings place their own docks: the rooms without docks, and how many docks in all (two come with every structure). */
const undocked = (c: Ctx): { rooms: RoomSpec[]; docks: number } => {
  const all = roomsOf(c);
  const rooms = all.filter((r) => r.role !== 'dock');
  return { rooms, docks: 2 + all.length - rooms.length };
};

/** Reactor rooms for a lattice (rings put them on their east run). */
function reactorRooms(k0: number): RoomSpec[] {
  const out: RoomSpec[] = [];
  for (let k = k0; k > 0; k -= 2) out.push({ role: 'reactor', mods: Array<string>(Math.min(2, k)).fill('module.reactor'), w: 2 * Math.min(2, k) + 2, h: 4 });
  return out;
}

function ringBlock(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], reactors: number, label: string, docks = 2): Block | null {
  const spokes = shuffle(rng, ['n', 's', 'w', 'e'] as Side[]).slice(0, rng.int(2, 4));
  const o = { extra: rng.int(0, 2), weight: [rng.pick([0.8, 1, 1.3]), rng.pick([0.8, 1, 1.3]), rng.pick([0.8, 1, 1.6])], inner: true, east: true, docks };
  return civil(ringStation(rng, hub, shuffle(rng, rooms), 0, reactors, spokes, o), 'command', label);
}

function latticeBlock(rng: Rng, first: RoomSpec, rooms: RoomSpec[], reactors: number, label: string, holes?: number): Block | null {
  const o = { gx: rng.int(2, 5), gy: rng.int(2, 4), spread: rng.pick([0.8, 1.2, 1.8]), holes: holes ?? rng.pick([0, 0.15]), pad: rng.int(0, 1) };
  return civil(latticeStation(rng, [first, ...shuffle(rng, [...rooms, ...reactorRooms(reactors)])], 0, o), 'command', label);
}

function ring(c: Ctx): boolean {
  const { rooms, docks } = undocked(c);
  const b = ringBlock(c.rng, c.plan.command, rooms, c.plan.reactors, 'ring station', docks);
  if (!b) return no(c, 'ring');
  c.A.placeRoot(b);
  return true;
}

function lattice(c: Ctx): boolean {
  const b = latticeBlock(c.rng, c.plan.command, roomsOf(c), c.plan.reactors, 'lattice station');
  if (!b) return no(c, 'lattice');
  c.A.placeRoot(b);
  return true;
}

/** Split rooms into `k` groups of similar floor area (largest first, each to the smallest group). */
function split(rooms: RoomSpec[], k: number): RoomSpec[][] {
  const out: RoomSpec[][] = Array.from({ length: k }, () => []);
  const area = (g: RoomSpec[]): number => g.reduce((t, r) => t + r.w * r.h, 0);
  for (const r of [...rooms].sort((a, b) => b.w * b.h - a.w * a.h)) {
    const g = out.reduce((best, x) => (area(x) < area(best) ? x : best), out[0] as RoomSpec[]);
    g.push(r);
  }
  return out;
}

const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** Hub: the core ring (control, AI core, shields, reactors) and satellites on spokes, one per side. */
function hubStation(c: Ctx): boolean {
  const { rooms: all, docks } = undocked(c);
  const coreRooms = all.filter((r) => r.role === 'core' || r.role === 'shields');
  const rest = shuffle(c.rng, all.filter((r) => !coreRooms.includes(r)));
  const k = c.rng.int(2, 4);
  const groups = split(rest, k + 1);
  // Reactors spread over the core and the satellites, so no ring run grows long on its reactor rooms alone.
  const share = Math.ceil(c.plan.reactors / (k + 1));
  let reactors = c.plan.reactors - share;
  const root = ringBlock(c.rng, c.plan.command, [...coreRooms, ...(groups[0] ?? [])], share, 'hub core ring', docks);
  if (!root) return no(c, 'core ring');
  const r0 = c.A.placeRoot(root);
  const sides = shuffle(c.rng, ['n', 's', 'w', 'e'] as Side[]).slice(0, k);
  c.parts.push(`satellites ${sides.join('')}`);
  for (const [i, side] of sides.entries()) {
    const g = groups[i + 1] ?? [];
    const head = g.find((r) => r.role === 'support' || r.role === 'quarters') ?? g[0];
    if (!head) continue;
    const body = g.filter((r) => r !== head);
    // Few-dock kinds (depots) get ring satellites with no docks of their own; lattices always bring two.
    const rx = i === sides.length - 1 ? reactors : Math.min(reactors, share);
    reactors -= rx;
    const sat = docks <= 2 || c.rng.chance(0.5) ? ringBlock(c.rng, head, body, rx, 'satellite ring', docks <= 2 ? 0 : 2) : latticeBlock(c.rng, head, body, rx, 'satellite lattice');
    if (!sat) return no(c, 'satellite');
    // A longer spoke when the satellite would clash with what is already there.
    let id: number | null = null;
    const width = c.rng.int(1, 2);
    for (let len = c.rng.int(4, 8); id === null && len <= 24; len += 6) {
      const spoke = hallBlock(c.rng, len, width, side === 'e' || side === 'w');
      const s = c.A.attach(r0, spoke, { side, align: 'mid' }) ?? c.A.attach(r0, spoke, { side, align: 'any' });
      if (s === null) return no(c, `spoke ${side}`);
      id = c.A.attach(s, sat, { side, align: 'mid', parentPort: side, doors: 2 }) ?? c.A.attach(s, sat, { side, align: 'any', parentPort: side });
      if (id === null) c.A.undoLast();
    }
    if (id === null) return no(c, `satellite ${side} (from ${OPP[side]})`);
  }
  return true;
}

/** Welded den: a small lattice core, its other rooms in welded-on clumps, scrappy loot pods hung off anything. */
function welded(c: Ctx): boolean {
  const all = shuffle(c.rng, roomsOf(c));
  const k = c.rng.int(1, 3);
  const groups = split(all, k + 1);
  const root = latticeBlock(c.rng, c.plan.command, groups[0] ?? [], c.plan.reactors, 'den core', 0.3);
  if (!root) return no(c, 'den core');
  const ids = [c.A.placeRoot(root)];
  for (let i = 1; i <= k; i++) {
    const g = groups[i] ?? [];
    const head = g[0];
    if (!head) continue;
    const blk = c.rng.chance(0.5) ? latticeBlock(c.rng, head, g.slice(1), 0, 'welded lattice', 0.3) : ringBlock(c.rng, head, g.slice(1), 0, 'welded ring');
    if (!blk) return no(c, 'welded module');
    const host = c.rng.pick(ids);
    const side = c.rng.pick(['n', 's', 'w', 'e'] as Side[]);
    const id = c.A.attach(host, blk, { side, align: 'any', doors: 1 }) ?? c.A.attach(ids[0] as number, blk, { side: OPP[side], align: 'any', doors: 1 });
    if (id === null) return no(c, 'weld');
    ids.push(id);
  }
  for (let p = c.rng.int(1, 3); p > 0; p--) {
    const pods = civil(podString(c.rng, c.rng.int(4, 10), true), 'cargo', 'loot pods');
    if (pods) c.A.attach(c.rng.pick(ids), pods, { side: c.rng.pick(['n', 's', 'w', 'e'] as Side[]), align: 'any', doors: 1 });
  }
  c.parts.push(`welded ${ids.length}`);
  return true;
}

/** Ore cages (mining): rows of ore holds on a rail, hung below or above any placed module. */
function cages(c: Ctx): boolean {
  const n = c.fam.cages ?? 0;
  const hosts = c.A.placed.map((_, i) => i);
  for (let k = 0; k < n; k++) {
    const o = { hw: c.rng.int(2, 3), hh: c.rng.int(3, 4), gap: c.rng.int(1, 4), every: c.rng.int(1, 2), tooth: c.rng.int(1, 3) };
    const cage = oreCage(c.rng, c.rng.int(12, 24), o, 5);
    let done = false;
    // Outermost ports first (a ring's inner walls face its empty centre), then anything outside every other block.
    const tries = shuffle(c.rng, hosts).flatMap((host) => (['s', 'n'] as Side[]).flatMap((side) =>
      blockOf(c, host).ports.filter((p) => p.side === side).sort((p, q) => (side === 's' ? q.y - p.y : p.y - q.y)).slice(0, 3)
        .map((p) => ({ host, side, port: p.id }))));
    for (const t of tries) {
      const id = c.A.attach(t.host, t.side === 's' ? cage : mirrorBlock(cage), { side: t.side, parentPort: t.port, align: 'any', doors: 1 });
      if (id === null) continue;
      // Open space beyond the cage (no structure further out): never inside a ring's empty centre.
      const b = c.A.bounds(id);
      const box = c.A.box();
      let inside = false;
      for (let x = b.x; x < b.x + b.w && !inside; x++) {
        if (t.side === 's') { for (let y = b.y + b.h; y <= box.y1 && !inside; y++) inside = (c.A.cell(x, y) ?? '.') !== '.'; }
        else for (let y = b.y - 1; y >= box.y0 && !inside; y--) inside = (c.A.cell(x, y) ?? '.') !== '.';
      }
      if (!inside) { done = true; break; }
      c.A.undoLast();
    }
    if (!done) return no(c, 'ore cage');
  }
  if (n > 0) c.parts.push(`cages ${n}`);
  return true;
}

const withCages = (run: (c: Ctx) => boolean) => (c: Ctx): boolean => run(c) && cages(c);

export const STATION_GRAMMARS: Record<'stationRing' | 'stationLattice' | 'stationHub' | 'stationWelded', (c: Ctx, f: FactionDef) => boolean> = {
  stationRing: withCages(ring), stationLattice: withCages(lattice), stationHub: withCages(hubStation), stationWelded: withCages(welded),
};
