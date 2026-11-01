import { mirrorBlock, type Block, type Side } from './arranger';
import { hallBlock } from './blocks';
import { podString } from './civilBlocks';
import { oreCage } from './civilFrames';
import { latticeStation, ringStation } from './civilStations';
import type { Builder } from './builder';
import { courtyards } from './stationCourts';
import { arcStation, concentricStation, wheelStation } from './stationRings';
import { plannedWheel } from './stationWheel';
import { tagged, warehoused } from './stationDepartments';
import { dockSpec, MK1_REACTOR, type Reactor, type RoomSpec } from './plan';
import { blockOf, civil, shuffle } from './civilKit';
import { no, type Ctx } from './navyKit';
import { cardinal, fullRooms, placeRoot, reactorOf, reactorRooms, roomsOf, runs, split, zoned } from './stationKit';
import { STATION_LAYOUTS } from './stationLayouts';
import type { Rng } from '../rng';
import type { StationGrammar } from './stationTypes';
import type { FactionDef } from './types';

/**
 * Station topologies on the shared arranger, built from the civil ring and lattice stations (`civilStations.ts`) with
 * no thrusters. Every room of the plan (guns are floor bays under roof turrets) goes inside the structure:
 *   stationRing     one ring round an empty centre, the control room on its hub
 *   stationLattice  modules on a grid linked by tubes and beams
 *   stationHub      a core ring with two to four satellite rings or lattices on long spoke corridors (system hubs)
 *   stationWelded   a small core with modules and loot pods welded straight onto it, no spokes (pirate dens)
 */

/** Rings place their own docks: the rooms without docks, and how many docks in all (two come with every structure). */
const undocked = (c: Ctx): { rooms: RoomSpec[]; docks: number } => {
  const all = roomsOf(c);
  const rooms = all.filter((r) => r.role !== 'dock');
  return { rooms, docks: 2 + all.length - rooms.length };
};

type Court = (b: Builder | null) => Builder | null;

/** The kind's courtyard rule for one block: enclosed centres become an open room (seeded per block, for variety). */
const courtOf = (c: Ctx, maxCourts?: number): Court => (b) => {
  const a = c.fam.atrium;
  if (b && a && maxCourts !== 0 && c.rng.chance(a.chance) && courtyards(b, c.rng, a.role, { band: a.band, ...(a.packed ? { packed: true } : {}), ...(a.deck ? { deck: true } : {}), ...(maxCourts ? { maxCourts } : {}) }) > 0 && !c.parts.includes('atrium')) c.parts.push('atrium');
  return b;
};

function ringBlock(rng: Rng, hub: RoomSpec, rooms: RoomSpec[], reactors: number, label: string, docks = 2, court: Court = (b) => b, reactor: Reactor = MK1_REACTOR): Block | null {
  const spokes = shuffle(rng, ['n', 's', 'w', 'e'] as Side[]).slice(0, rng.int(2, 4));
  const o = { extra: rng.int(0, 2), weight: [rng.pick([0.8, 1, 1.3]), rng.pick([0.8, 1, 1.3]), rng.pick([0.8, 1, 1.6])], inner: true, east: true, docks, reactor };
  return civil(court(ringStation(rng, hub, zoned(rng, rooms), 0, reactors, spokes, o)), 'command', label);
}

function latticeBlock(rng: Rng, first: RoomSpec, rooms: RoomSpec[], reactors: number, label: string, holes?: number, docks = 2, reactor: Reactor = MK1_REACTOR): Block | null {
  const o = { gx: rng.int(2, 5), gy: rng.int(2, 4), spread: rng.pick([0.8, 1.2, 1.8]), holes: holes ?? rng.pick([0, 0.15]), pad: rng.int(0, 1), docks };
  return civil(latticeStation(rng, [first, ...zoned(rng, [...rooms, ...reactorRooms(reactors, reactor)])], 0, o), 'command', label);
}

function ring(c: Ctx): boolean {
  const { rooms, docks } = undocked(c);
  const b = ringBlock(c.rng, c.plan.command, rooms, c.plan.reactors, 'ring station', docks, courtOf(c), reactorOf(c.plan));
  if (!b) return no(c, 'ring');
  c.A.placeRoot(b);
  return true;
}

function lattice(c: Ctx): boolean {
  const b = latticeBlock(c.rng, c.plan.command, roomsOf(c), c.plan.reactors, 'lattice station', undefined, 2, reactorOf(c.plan));
  if (!b) return no(c, 'lattice');
  c.A.placeRoot(b);
  return true;
}

const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
/** Rooms a spoke may open into: corridors and open courts. */
const HALLS = ['hall', 'plaza', 'garden', 'drill'] as const;

/** Hub: the core ring (control, AI core, shields, reactors) and satellites on spokes, one per side. */
function hubStation(c: Ctx): boolean {
  const { rooms: all, docks } = undocked(c);
  const coreRooms = all.filter((r) => r.role === 'core' || r.role === 'shields');
  const rest = zoned(c.rng, all.filter((r) => !coreRooms.includes(r)));
  const k = c.rng.int(2, 4);
  // Satellites by district: the zoned list cut into runs, so each satellite (and the core) is mostly one district.
  const groups = runs(rest, k + 1);
  // Reactors spread over the core and the satellites, so no ring run grows long on its reactor rooms alone.
  const share = Math.ceil(c.plan.reactors / (k + 1));
  let reactors = c.plan.reactors - share;
  // The core is a square ring or a round wheel; satellites are rings, wheels or lattices.
  const wheelOf = (hub: RoomSpec, rs: RoomSpec[], rx: number, dk: number, label: string): Block | null =>
    civil(courtOf(c)(wheelStation(c.rng, hub, [...rs, ...reactorRooms(rx, reactorOf(c.plan)), ...Array.from({ length: dk }, () => dockSpec())], { spokes: cardinal(c, 2), extra: 0, centre: 0 })), 'command', label);
  const root = c.rng.chance(0.5)
    ? wheelOf(c.plan.command, [...coreRooms, ...(groups[0] ?? [])], share, docks, 'hub core wheel')
    : ringBlock(c.rng, c.plan.command, [...coreRooms, ...(groups[0] ?? [])], share, 'hub core ring', docks, courtOf(c), reactorOf(c.plan));
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
    const pick = c.rng.int(0, 2);
    const sat = pick === 0 ? wheelOf(head, body, rx, docks <= 2 ? 0 : 2, 'satellite wheel')
      : pick === 1 || docks <= 2 ? ringBlock(c.rng, head, body, rx, 'satellite ring', docks <= 2 ? 0 : 2, courtOf(c), reactorOf(c.plan)) : latticeBlock(c.rng, head, body, rx, 'satellite lattice', undefined, 2, reactorOf(c.plan));
    if (!sat) return no(c, 'satellite');
    // A longer spoke when the satellite would clash with what is already there.
    let id: number | null = null;
    const width = c.rng.int(1, 2);
    for (let len = c.rng.int(4, 8); id === null && len <= 24; len += 6) {
      const spoke = hallBlock(c.rng, len, width, side === 'e' || side === 'w');
      // The spoke joins corridor to corridor: entering a satellite through a room would put the whole satellite behind
      // it (an armoury, or crew quarters).
      const halls = { parent: HALLS, child: HALLS };
      const s = c.A.attach(r0, spoke, { side, align: 'mid', into: { parent: HALLS } }) ?? c.A.attach(r0, spoke, { side, align: 'any', into: { parent: HALLS } });
      if (s === null) return no(c, `spoke ${side}`);
      id = c.A.attach(s, sat, { side, align: 'mid', parentPort: side, doors: 2, into: halls }) ?? c.A.attach(s, sat, { side, align: 'any', parentPort: side, into: halls });
      if (id === null) c.A.undoLast();
    }
    if (id === null) return no(c, `satellite ${side} (from ${OPP[side]})`);
  }
  return true;
}

/**
 * Annexed: a wheel or ring with a wing bolted on later, a lattice of modules on a short corridor (an industrial or
 * habitation wing, the history a single-shape station lacks). The zoned room list is cut about two thirds in, so the
 * wing carries one district and the core the rest, docks included.
 */
function annexed(c: Ctx): boolean {
  const { rooms: all, docks } = undocked(c);
  const keep = all.filter((r) => r.role === 'core' || r.role === 'shields');
  const rest = zoned(c.rng, all.filter((r) => !keep.includes(r)));
  const total = rest.reduce((t, r) => t + r.w * r.h, 0);
  const wing: RoomSpec[] = [];
  for (let a = 0; rest.length > 0 && a < total * 0.32;) { const r = rest.pop() as RoomSpec; wing.unshift(r); a += r.w * r.h; }
  const head = wing.find((r) => r.role === 'support' || r.role === 'quarters' || r.role === 'cargo') ?? wing[0];
  if (!head) return no(c, 'annex wing');
  const wingReactors = Math.max(1, Math.round(c.plan.reactors * 0.3));
  const coreRooms = [...keep, ...rest];
  const core = c.rng.chance(0.5)
    ? civil(courtOf(c)(wheelStation(c.rng, c.plan.command, [...coreRooms, ...reactorRooms(c.plan.reactors - wingReactors, reactorOf(c.plan)), ...Array.from({ length: docks }, () => dockSpec())], { spokes: cardinal(c, 2), extra: 0, centre: 0 })), 'command', 'annexed wheel')
    : ringBlock(c.rng, c.plan.command, coreRooms, c.plan.reactors - wingReactors, 'annexed ring', docks, courtOf(c), reactorOf(c.plan));
  if (!core) return no(c, 'annex core');
  const r0 = c.A.placeRoot(core);
  const annex = latticeBlock(c.rng, head, wing.filter((r) => r !== head), wingReactors, 'annex wing', 0, 0, reactorOf(c.plan));
  if (!annex) return no(c, 'annex wing');
  const halls = { parent: HALLS, child: HALLS };
  for (const side of shuffle(c.rng, ['n', 's', 'w', 'e'] as Side[])) {
    const spoke = hallBlock(c.rng, c.rng.int(3, 6), c.rng.int(1, 2), side === 'e' || side === 'w');
    const s = c.A.attach(r0, spoke, { side, align: 'any', into: { parent: HALLS } });
    if (s === null) continue;
    if (c.A.attach(s, annex, { side, align: 'any', parentPort: side, into: halls }) !== null) {
      c.parts.push(`annex ${side}`);
      return true;
    }
    c.A.undoLast();
  }
  return no(c, 'annex attach');
}

/** Welded den: a small lattice core, its other rooms in welded-on clumps, scrappy loot pods hung off anything. */
function welded(c: Ctx): boolean {
  const all = shuffle(c.rng, roomsOf(c));
  const k = c.rng.int(1, 3);
  const groups = split(all, k + 1);
  const root = latticeBlock(c.rng, c.plan.command, groups[0] ?? [], c.plan.reactors, 'den core', 0.3, 2, reactorOf(c.plan));
  if (!root) return no(c, 'den core');
  const ids = [c.A.placeRoot(root)];
  for (let i = 1; i <= k; i++) {
    const g = groups[i] ?? [];
    const head = g[0];
    if (!head) continue;
    // Welded-on modules bring no airlocks of their own: the den keeps the docks its tier asks for.
    const blk = c.rng.chance(0.5) ? latticeBlock(c.rng, head, g.slice(1), 0, 'welded lattice', 0.3, 0) : ringBlock(c.rng, head, g.slice(1), 0, 'welded ring', 0);
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

/**
 * Wheel: four spokes, so the inside of the ring is four quarters; none, one or two of them are filled as courts, the
 * rest stay open to space.
 */
function wheel(c: Ctx): boolean {
  const courts = c.rng.int(0, 2);
  const w = plannedWheel(c.rng, office(c), !!c.fam.market);
  c.parts.push(`spokes nesw courts ${courts}`, ...(w ? [w.label] : []));
  return placeRoot(c, civil(courtOf(c, courts)(w?.b ?? null), 'command', 'wheel station'), 'wheel');
}

/** Hub spokes always include north and south: the concourse runs dock bank to hub to dock bank. */
const concourse = (sides: Side[]): Side[] => [...new Set<Side>(['n', 's', ...sides])];

/**
 * The rooms of a round civil station with its bridge among them: the bridge is the station's administration, beside
 * the main dock (stationDistricts.ts), and a rotunda takes the centre.
 */
const office = (c: Ctx): RoomSpec[] => tagged(warehoused(customs([{ ...c.plan.command, pinned: true }, ...fullRooms(c)])));

/** The first armoury is the customs post: pinned (role swaps leave it), so it stays beside the office at the main dock. */
function customs(rooms: RoomSpec[]): RoomSpec[] {
  const i = rooms.findIndex((r) => r.role === 'armoury');
  return i < 0 ? rooms : rooms.map((r, j) => (j === i ? { ...r, pinned: true } : r));
}

/**
 * Concentric: civil stations put a rotunda at the centre and the bridge by the docks; military ones keep the bridge at
 * the heart, entered by the north spoke only (a guard post beside it), the concourse ending at its door.
 */
function concentric(c: Ctx): boolean {
  const heart = c.fam.command === 'heart';
  c.parts.push(heart ? 'command heart' : 'rotunda');
  const b = heart
    ? concentricStation(c.rng, c.plan.command, tagged(warehoused(fullRooms(c))), ['n'])
    : concentricStation(c.rng, null, office(c), concourse(cardinal(c, 2)), !!c.fam.market);
  return placeRoot(c, civil(courtOf(c, 1)(b), 'command', 'concentric station'), 'concentric');
}

function arc(c: Ctx): boolean {
  const span = c.rng.pick([Math.PI, Math.PI * 1.25, Math.PI * 1.5]);
  c.parts.push(`span ${Math.round((span * 180) / Math.PI)}`);
  return placeRoot(c, civil(arcStation(c.rng, c.plan.command, fullRooms(c), span), 'command', 'arc station'), 'arc');
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

export const STATION_GRAMMARS: Record<StationGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  stationRing: withCages(ring), stationLattice: withCages(lattice), stationHub: withCages(hubStation), stationWelded: withCages(welded),
  stationWheel: withCages(wheel), stationConcentric: withCages(concentric), stationArc: withCages(arc),
  stationAnnex: withCages(annexed), stationSpine: withCages(STATION_LAYOUTS.spine), stationCross: withCages(STATION_LAYOUTS.cross), stationTree: withCages(STATION_LAYOUTS.tree),
};
