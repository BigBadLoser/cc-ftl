import { mirrorBlock, type Block, type Side } from './arranger';
import { blockFrom, hallBlock, localBuilder } from './blocks';
import type { Builder } from './builder';
import { barge, cockpit, drive, habitat, podString, station, type DriveStyle } from './civilBlocks';
import { boomRig, containerFrame, linerBody, oreCage, truss, trussBridge, type LinerShape } from './civilFrames';
import { latticeStation, ringStation } from './civilStations';
import { dockBlock } from './navyBlocks';
import { jobs, no, type Ctx } from './navyKit';
import { mountGuns } from './navyMounts';
import { type RoomSpec } from './plan';
import type { Rng } from '../rng';
import { freeze } from './salvage';
import type { CivilGrammar, FactionDef } from './types';

/**
 * Civilian grammars on the shared arranger, from the shared civil builders (`civilBlocks.ts`, also the scrappers'
 * donors) and the civil frames (`civilFrames.ts`, `civilStations.ts`). Lightly armed: point defence in the core room,
 * the odd single light gun on a sponson. Each family has several topologies, drawn once per ship (`c.variant`), and
 * most of them join sideways or lengthways (grafts and beams), not corridor end to corridor end:
 *   freighter  frame (containers slung between beam rails, crew and drive aft), offset (the crew block beside the
 *              cargo mass), tug (a crewed tug pushing a cargo body on a truss)
 *   liner      one wide 2D hull (teardrop, oval, or a flat twin hull), cockpit fore, drive aft
 *   mining     cage (an ore cage beside the crew block), boom (the rig on a long offset boom), struts (v20, minority)
 *   station    ring (rooms round an empty centre, spokes to a hub), lattice (modules on a grid, tubes and beams),
 *              stack (large modules offset along a mast); thrusters inside the structure, no bow or stern
 */

const civil = (b: Builder | null, kind: string, label: string): Block | null => (b ? freeze(b, kind, label, 'civil') : null);
const blockOf = (c: Ctx, i: number): Block => (c.A.placed[i] as { block: Block }).block;

function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
/** A block's corridor-end port on a side (civil sections join corridor to corridor: one straight run). */
const hallPort = (b: Block, side: Side): string | undefined => b.ports.find((p) => p.side === side && (p.id.startsWith('h') || p.id === side))?.id;

/** Join `blk` aft of `host` (or on another face), corridor end to corridor end where both have one. */
function join(c: Ctx, host: number, blk: Block | null, side: Side = 'e'): number | null {
  if (!blk) return null;
  const pp = hallPort(blockOf(c, host), side);
  const cp = hallPort(blk, OPP[side]);
  const straight = c.A.attach(host, blk, { side, align: 'mid', ...(pp ? { parentPort: pp } : {}), ...(cp ? { childPort: cp } : {}) });
  return straight ?? c.A.attach(host, blk, { side, align: 'mid' });
}

/** The drive aft of `host`: a light civil drive in a seeded style, the first that is no taller than its host. */
function stern(c: Ctx, host: number): boolean {
  const H = blockOf(c, host).rows.length;
  const styles = shuffle(c.rng, ['nozzle', 'pair', 'nacelles'] as DriveStyle[]);
  const built = styles.map((s) => civil(drive(c.rng, c.plan.engines, c.plan.reactors, s), 'drive', `${s} drive`)).filter((b): b is Block => !!b);
  const order = [...built.filter((b) => b.rows.length <= H), ...built.filter((b) => b.rows.length > H).sort((a, b) => a.rows.length - b.rows.length)];
  for (const d of order) if (join(c, host, d) !== null) { c.parts.push(d.label.replace('civil: ', '')); return true; }
  return no(c, 'drive');
}

/** The odd light gun: sponsons on the given hosts (spread). */
const arms = (c: Ctx, hosts: number[], guns: RoomSpec[]): boolean =>
  guns.length === 0 || mountGuns(c, hosts.map((h) => ({ n: h, s: h })), guns, { cluster: 'spread' }).length === 0 || no(c, 'guns');

const cratesOf = (stores: RoomSpec[]): number => stores.reduce((t, r) => t + r.mods.length, 0);

/** An empty observation room (a dome or blister), `w` x `h`. */
function dome(rng: Rng, w: number, h: number): Block | null {
  const b = localBuilder(rng);
  return b.place({ x: 0, y: -1 - Math.ceil(h / 2), w: w + 2, h: h + 2 }, 'support', { role: 'support', mods: [], w, h }) ? freeze(b, 'observation', 'observation dome', 'civil') : null;
}

/** Liner bow: the cockpit alone, or with an observation dome (or a stepped pair of domes) ahead of it. */
function linerBow(c: Ctx, root: number): boolean {
  const form = c.rng.pick(['plain', 'dome', 'stepped'] as const);
  c.parts.push(`bow ${form}`);
  if (form === 'plain') return true;
  const d1 = dome(c.rng, c.rng.int(2, 4), c.rng.int(3, 6));
  const a = d1 ? c.A.attach(root, d1, { side: 'w', align: 'mid', doors: 1 }) : null;
  if (a === null) return no(c, 'dome');
  if (form === 'dome') return true;
  const d2 = dome(c.rng, c.rng.int(2, 3), c.rng.int(2, Math.max(2, (d1?.rows.length ?? 5) - 4)));
  return (d2 !== null && c.A.attach(a, d2, { side: 'w', align: 'mid', doors: 1 }) !== null) || no(c, 'dome');
}

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
  truss(b, L, top, 1, 2 * spread + 1, 'cross');
  lens.forEach((len, i) => {
    const t = c.rng.int(1, 2);
    const y = Math.min(top + 2 * spread + 1 - t, top + Math.round((i * (2 * spread + 1 - t)) / Math.max(1, n - 1)));
    truss(b, L - len, y, len, t, `arm${i}`);
  });
  const blk = blockFrom(b, 'beam', 'mining rig', 'external', [{ id: 'e', side: 'e', x: L + 1, y: top, len: 2 * spread + 1, access: 'external' }]);
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
  truss(b, reach, -out, 1, out, 'strut');
  truss(b, 0, -out, reach, 1, 'arm');
  if (rake > 0) truss(b, reach + 1, -out, rake, 1, 'rake');
  const blk = blockFrom(b, 'beam', 'mining rig', 'external', [{ id: 's', side: 's', x: reach, y: 0, len: 1, access: 'external' }]);
  for (const [side, r] of [['n', blk], ['s', mirrorBlock(blk)]] as const) {
    if (c.A.attach(host, r, { side, align: 'mid', doors: 0, kind: 'beam' }) === null) return no(c, 'mid rig');
  }
  c.parts.push(`mid rig ${out}/${reach}${rake ? ' raked' : ''}`);
  return true;
}

/** Mining (v20 struts, a minority): a cockpit, ore barges in line, the rig fore of the bow or mid-ship. */
function struts(c: Ctx): boolean {
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

/** Pick a topology from the ship's variant draw (shared by every candidate arrangement of the ship). */
function byVariant<T extends string>(c: Ctx, set: [T, number][]): T {
  const total = set.reduce((t, [, w]) => t + w, 0);
  let r = (c.variant ?? c.rng.next()) * total;
  for (const [t, w] of set) if ((r -= w) < 0) return t;
  return (set[set.length - 1] as [T, number])[0];
}

/** The crew block: the bridge with the crew rooms beside its stub. */
function crewBlock(c: Ctx, rooms: RoomSpec[]): number | null {
  const bow = civil(cockpit(c.rng, c.plan.command, rooms), 'command', 'cockpit');
  return bow ? c.A.placeRoot(bow) : null;
}

/**
 * The compact crewed body: the cockpit (bridge, core, airlocks beside its stub) and, aft of it, the quarters and
 * support rooms as a habitat ring module (2D, not a stub run). `aft` is the module the drive joins.
 */
function crewBody(c: Ctx): { root: number; aft: number } | null {
  const j = jobs(c.plan);
  const docks = j.crew.filter((r) => r.role === 'dock');
  const crew = j.crew.filter((r) => r.role !== 'dock');
  const root = crewBlock(c, [...j.core, ...docks]);
  if (root === null || crew.length === 0) return root === null ? null : { root, aft: root };
  const hub = crew.find((r) => r.role === 'support') ?? (crew[0] as RoomSpec);
  const rest = crew.filter((r) => r !== hub);
  const hab = join(c, root, civil(habitat(c.rng, hub, rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)), 'habitat', 'crew module'));
  return hab === null ? null : { root, aft: hab };
}

/**
 * A cargo body beside a crewed block, flush with its after end (so the drive aft stays clear), on a seeded side; it
 * is built hanging below its own port ('n'), mirrored for the north side. One door joins them.
 */
function beside(c: Ctx, host: number, blk: Block, flushOnly = false): number | null {
  const first = c.rng.chance(0.5) ? 'n' : 's';
  for (const side of [first, first === 'n' ? 's' : 'n'] as const) {
    const b = side === 's' ? blk : mirrorBlock(blk);
    // Flush aft: the body's last tile against the after end of the host's after-most port on that side.
    // The host's outermost wall line on that side, its after-most port.
    const out = (p: { y: number }): number => (side === 's' ? p.y : -p.y);
    const hp = blockOf(c, host).ports.filter((p) => p.side === side).sort((p, q) => out(q) - out(p) || q.x + q.len - (p.x + p.len))[0];
    const P = c.A.placed[host];
    const xMax = P && hp ? P.x + hp.x + hp.len : undefined;
    const flush = hp ? c.A.attach(host, b, { side, parentPort: hp.id, align: 'start', shift: hp.len - 1, doors: 1, ...(xMax !== undefined ? { xMax } : {}) }) : null;
    if (flush !== null) return flush;
    if (flushOnly) continue;
    for (const align of ['end', 'mid', 'start'] as const) {
      const id = c.A.attach(host, b, { side, align, doors: 1 });
      if (id !== null) return id;
    }
  }
  return null;
}

/** Join through a door (frame). */
const frameJoin = (c: Ctx, host: number, blk: Block, side: Side): number | null => c.A.attach(host, blk, { side, align: 'mid', doors: 2 });

/** Freighter: frame, offset bridge or tug and barge. */
function freighter(c: Ctx): boolean {
  const j = jobs(c.plan);
  const crates = Math.max(6, cratesOf(j.stores));
  const topo = byVariant(c, [['frame', 3], ['offset', 2], ['tug', 2]] as ['frame' | 'offset' | 'tug', number][]);
  c.parts.push(topo);
  const body = crewBody(c);
  if (!body) return no(c, 'crew body');
  const { root, aft } = body;
  const cw = c.rng.int(3, 5);
  const ch = c.rng.int(2, 3);
  if (topo === 'frame') {
    // Containers slung between two rails, an open lane between the rows, the crew block and drive aft.
    const fr = containerFrame(c.rng, crates * 3, { lane: c.rng.int(1, 3), gap: c.rng.int(1, 2), cw, ch: ch + 1 });
    if (frameJoin(c, root, fr, 'w') === null) return no(c, 'frame');
    return stern(c, aft) && arms(c, [root, aft], j.guns);
  }
  if (!stern(c, aft)) return false;
  // The cargo mass: containers packed two or three deep.
  const mass = containerFrame(c.rng, crates * 3, { lane: 0, gap: c.rng.int(0, 1), cw, ch: ch + c.rng.int(1, 2) });
  if (topo === 'offset') return (beside(c, aft, mass) !== null || no(c, 'cargo mass')) && arms(c, [root, aft], j.guns);
  const t = frameJoin(c, root, trussBridge(c.rng, c.rng.int(5, 10), c.rng.chance(0.7)), 'w');
  if (t === null || frameJoin(c, t, mass, 'w') === null) return no(c, 'barge');
  return arms(c, [root, aft], j.guns);
}

/** Liner: one wide hull (cabins in 2D, lounges fore), a cockpit ahead of it, the drive aft. */
function linerHull(c: Ctx): boolean {
  const j = jobs(c.plan);
  const docks = j.crew.filter((r) => r.role === 'dock');
  const root = crewBlock(c, [...j.core, ...docks, ...j.stores]);
  if (root === null) return no(c, 'cockpit');
  const shape = byVariant(c, [['teardrop', 2], ['oval', 2], ['twin', 2]] as [LinerShape, number][]);
  const beds = c.plan.quarters.reduce((t, r) => t + r.mods.filter((m) => m === 'module.bed').length, 0);
  const ls = c.plan.quarters.flatMap((r) => r.mods.filter((m) => m !== 'module.bed'));
  const lounges: RoomSpec[] = [{ role: 'support' as const, mods: ls, w: c.rng.int(3, 4), h: 3 }, ...c.plan.support.map((s) => ({ ...s, w: Math.max(3, s.w) }))].filter((r) => r.mods.length > 0);
  const cabin = c.rng.pick([[2, 2], [3, 2], [2, 3]] as [number, number][]);
  const body = join(c, root, civil(linerBody(c.rng, beds, lounges, shape, cabin), 'habitat', `${shape} hull`));
  if (body === null) return no(c, 'hull');
  c.parts.push(shape);
  if (c.rng.chance(0.3) && !linerBow(c, root)) return false;
  return stern(c, body) && arms(c, [body], j.guns);
}

/** Mining: an ore cage beside the crew block, the rig on a long offset boom, or (a minority) v20's struts. */
function mining(c: Ctx): boolean {
  const topo = byVariant(c, [['cage', 3], ['boom', 3], ['struts', 1]] as ['cage' | 'boom' | 'struts', number][]);
  c.parts.push(topo);
  if (topo === 'struts') return struts(c);
  const j = jobs(c.plan);
  const crates = Math.max(6, cratesOf(j.stores));
  const body = crewBody(c);
  if (!body) return no(c, 'crew body');
  const { root, aft } = body;
  // The cage hangs flush aft beside the crew body, as long as fits alongside it (never past the drive).
  const hw = c.rng.int(2, 4);
  const hh = c.rng.int(3, 4);
  let cage: number | null = null;
  for (let k = 12; k >= 2 && cage === null; k--) cage = beside(c, aft, oreCage(c.rng, crates * 3, hw, hh, k), true);
  if (cage === null) return no(c, 'cage');
  if (!stern(c, aft)) return false;
  if (topo === 'cage') {
    if (c.rng.chance(0.5) && !bowRig(c, root)) return false;
    return arms(c, [root, aft], j.guns);
  }
  // Boom: the crew block with an ore cage beside it, the rig on a long boom off its other flank, reaching past the bow.
  const spread = c.rng.int(2, 5);
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

/** Station: ring, lattice or stack, picked by seed. */
function stationHull(c: Ctx): boolean {
  const j = jobs(c.plan);
  const crew = j.crew.filter((r) => r.role !== 'dock');
  const topo = byVariant(c, [['ring', 2], ['lattice', 2], ['stack', 2]] as ['ring' | 'lattice' | 'stack', number][]);
  c.parts.push(topo);
  if (topo === 'stack') return stack(c, crew);
  const rooms = [...j.core, ...crew, ...j.stores];
  if (topo === 'ring') {
    const spokes = shuffle(c.rng, ['n', 's', 'w', 'e'] as Side[]).slice(0, c.rng.int(2, 4));
    const b = civil(ringStation(c.rng, c.plan.command, rooms, c.plan.engines, c.plan.reactors, spokes), 'command', 'ring station');
    if (!b) return no(c, 'ring');
    return arms(c, [c.A.placeRoot(b)], j.guns);
  }
  const reactors: RoomSpec[] = [];
  for (let k = c.plan.reactors; k > 0; k -= 2) reactors.push({ role: 'reactor', mods: Array<string>(Math.min(2, k)).fill('module.reactor'), w: 2 * Math.min(2, k) + 2, h: 4 });
  const mods = shuffle(c.rng, [...rooms, ...reactors]);
  const b = civil(latticeStation(c.rng, [c.plan.command, ...mods], c.plan.engines, c.rng.int(3, 5), c.rng.int(3, 5)), 'command', 'lattice station');
  if (!b) return no(c, 'lattice');
  return arms(c, [c.A.placeRoot(b)], j.guns);
}

/** Stack station: large modules offset along a north-south mast, airlocks at its ends, a thruster on an east module. */
function stack(c: Ctx, crew: RoomSpec[]): boolean {
  const j = jobs(c.plan);
  const hubRooms = [c.plan.command, ...j.core.slice(0, 2), ...crew.splice(0, 1)].slice(0, 4);
  const mods: Block[] = [];
  const hub = civil(station(c.rng, hubRooms), 'command', 'station hub');
  const pods = civil(podString(c.rng, Math.max(4, cratesOf(j.stores))), 'cargo', 'cargo pods');
  if (!hub || !pods) return no(c, 'modules');
  mods.push(hub, pods);
  if (crew.length > 0) {
    const hubR = crew.find((r) => r.role === 'support') ?? (crew[0] as RoomSpec);
    const rest = [...crew.filter((r) => r !== hubR), ...j.core.slice(2)];
    const hab = civil(habitat(c.rng, hubR, rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)), 'habitat', 'habitat ring');
    if (!hab) return no(c, 'habitat');
    mods.push(hab);
  }
  const H = mods.reduce((t, m) => t + m.rows.length, 0);
  const mast = hallBlock(c.rng, Math.ceil(H * 0.75) + c.rng.int(2, 6), 1, false);
  for (const p of mast.ports) if (p.side === 'e' || p.side === 'w') p.multi = true;
  const root = c.A.placeRoot(mast);
  const order = shuffle(c.rng, mods);
  const aligns = ['start', 'mid', 'end'] as const;
  let side: Side = c.rng.chance(0.5) ? 'e' : 'w';
  let east: number | null = null;
  const hosts: number[] = [];
  for (const [i, m] of order.entries()) {
    const al = aligns[Math.min(2, Math.round((i * 2) / Math.max(1, order.length - 1)))] as 'start' | 'mid' | 'end';
    const id = c.A.attach(root, m, { side, align: al }) ?? c.A.attach(root, m, { side: side === 'e' ? 'w' : 'e', align: al });
    if (id === null) return no(c, 'module');
    hosts.push(id);
    if ((c.A.placed[id]?.x ?? 0) > (c.A.placed[root]?.x ?? 0)) east = id;
    side = side === 'e' ? 'w' : 'e';
  }
  for (const [d, lock] of [['n', dockBlock(c.rng)], ['s', mirrorBlock(dockBlock(c.rng))]] as const) {
    if (c.A.attach(root, lock, { side: d, align: 'mid', doors: 1 }) === null) return no(c, 'airlock');
  }
  return (east !== null || no(c, 'east module')) && stern(c, east as number) && arms(c, hosts, j.guns);
}

export const CIVIL_GRAMMARS: Record<CivilGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  freighter: (c) => freighter(c), liner: (c) => linerHull(c), mining: (c) => mining(c), station: (c) => stationHull(c),
};
