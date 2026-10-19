import { mirrorBlock, type Block, type Side } from './arranger';
import { blockFrom, hallBlock, localBuilder } from './blocks';
import type { Builder } from './builder';
import { barge, cabins, cockpit, containers, crossHub, drive, habitat, liner, lounge, podString, station, type DriveStyle } from './civilBlocks';
import { dockBlock } from './navyBlocks';
import { jobs, no, type Ctx } from './navyKit';
import { mountGuns } from './navyMounts';
import { dockSpec, type RoomSpec } from './plan';
import type { Rng } from '../rng';
import { freeze } from './salvage';
import type { CivilGrammar, FactionDef } from './types';

/**
 * Civilian grammars on the shared arranger, from the shared civil builders (`civilBlocks.ts`, also the scrappers'
 * donors). Lightly armed: point defence in the core room, the odd single light gun on a sponson. Every civilian ends
 * in a light civil drive (`drive`), never the navy's tall bank.
 *   freighter  a cockpit, a long spine of cargo containers, the drive
 *   liner      a bow (plain, or an observation dome), a train of cabin rows and lounges (some with blisters), the drive
 *   mining     a cockpit, ore hopper barges, a beam rig: fore of the bow or mid-ship, sweeping forward
 *   station    a hub (square, ring or cross), two to four arms with airlocks at their ends, pods and habitat on arms or
 *              hub faces, a small drive on the east arm or face: no bow or stern to speak of
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

/** An airlock on a west-facing arm end (entered from the east). */
function westDock(rng: Rng): Block {
  const b = localBuilder(rng);
  b.place({ x: 0, y: -2, w: 6, h: 3 }, 'dock', { ...dockSpec(), w: 4, h: 1 });
  return blockFrom(b, 'dock', 'dock', 'human', [{ id: 'e', side: 'e', x: 5, y: -1, len: 1, access: 'human' }]);
}

/** Freighter: a cockpit with the crew beside its stub, then cargo containers strung along a spine, the drive. */
function freighter(c: Ctx): boolean {
  const j = jobs(c.plan);
  const bow = civil(cockpit(c.rng, c.plan.command, [...j.core, ...j.crew]), 'command', 'cockpit');
  if (!bow) return no(c, 'cockpit');
  const root = c.A.placeRoot(bow);
  const crates = Math.max(4, cratesOf(j.stores));
  // The container train: one to three spines (at least six crates each), container size, spacing and stacking
  // drawn per ship.
  const halves = c.rng.int(1, Math.max(1, Math.min(3, Math.floor(crates / 6))));
  let host = root;
  const spines: number[] = [];
  const size = c.rng.int(3, 5);
  // Gap 2+ leaves open space between containers (1 only doubles the wall).
  const gap = c.rng.int(2, 3);
  const stagger = c.rng.chance(0.4) ? Math.ceil((size + 1 + gap) / 2) : 0;
  for (let i = 0; i < halves; i++) {
    const sp = join(c, host, civil(containers(c.rng, Math.ceil(crates / halves), size, gap, stagger), 'cargo', 'containers'));
    if (sp === null) return no(c, 'containers');
    spines.push(sp);
    host = sp;
  }
  c.parts.push(`containers ${crates}`);
  return stern(c, host) && arms(c, spines, j.guns);
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

/** A lounge (one or two public rooms) on a through corridor, now and then with observation blisters on it. */
function addLounge(c: Ctx, host: number, spec: RoomSpec): number | null {
  const depth = c.rng.int(3, 6);
  const rooms = spec.mods.length >= 2 && c.rng.chance(0.6)
    ? [{ ...spec, mods: spec.mods.filter((_, i) => i % 2 === 0) }, { ...spec, mods: spec.mods.filter((_, i) => i % 2 === 1) }]
    : [spec];
  const lo = join(c, host, civil(lounge(c.rng, rooms, depth, rooms.length === 1 && c.rng.chance(0.5)), 'lounge', 'lounge'));
  if (lo === null || !c.rng.chance(0.4)) return lo;
  const w = c.rng.int(2, 4);
  const h = c.rng.int(2, 3);
  for (const side of c.rng.chance(0.6) ? (['n', 's'] as const) : ([c.rng.pick(['n', 's'] as const)])) {
    const d = dome(c.rng, w, h);
    if (d) c.A.attach(lo, side === 'n' ? d : mirrorBlock(d), { side, align: 'mid', doors: 1 });
  }
  return lo;
}

/** Liner: a bow, then passenger segments (cabin rows and lounges in seeded forms), the drive. */
function linerHull(c: Ctx): boolean {
  const j = jobs(c.plan);
  const docks = j.crew.filter((r) => r.role === 'dock');
  const bow = civil(cockpit(c.rng, c.plan.command, [...j.core, ...docks, ...j.stores]), 'command', 'cockpit');
  if (!bow) return no(c, 'cockpit');
  let host = c.A.placeRoot(bow);
  if (!linerBow(c, host)) return false;
  const quarters = c.plan.quarters;
  const support = c.plan.support;
  // One to four passenger segments; each draws its own form, cabin size and lounge.
  const k = c.rng.int(1, Math.max(1, Math.min(4, quarters.length)));
  const shipCabin: [number, number] = c.rng.pick([[2, 2], [2, 3], [3, 2]] as [number, number][]);
  const segs: number[] = [];
  const forms: string[] = [];
  for (let i = 0; i < k; i++) {
    const q = quarters.filter((_, n) => n % k === i);
    const beds = Math.max(2, q.reduce((t, r) => t + r.mods.filter((m) => m === 'module.bed').length, 0));
    const ls = q.flatMap((r) => r.mods.filter((m) => m !== 'module.bed'));
    const cabin = c.rng.chance(0.3) ? c.rng.pick([[2, 2], [2, 3], [3, 2]] as [number, number][]) : shipCabin;
    const bulb = c.rng.int(5, 9);
    const spec: RoomSpec = { role: 'support', mods: [...ls, ...(support[i]?.mods ?? [])], w: c.rng.int(3, 5), h: bulb };
    const form = c.rng.pick(['bulb', 'band', 'split'] as const);
    forms.push(form);
    let seg: number | null;
    if (form === 'bulb') seg = join(c, host, civil(liner(c.rng, beds, spec, cabin, bulb), 'habitat', 'passenger segment'));
    else {
      const half = form === 'split' ? Math.ceil(beds / 2) : beds;
      const row = join(c, host, civil(cabins(c.rng, half, cabin), 'habitat', 'cabin row'));
      seg = row === null ? null : addLounge(c, row, spec);
      if (seg !== null && form === 'split') seg = join(c, seg, civil(cabins(c.rng, beds - half, cabin), 'habitat', 'cabin row'));
    }
    if (seg === null) return no(c, 'segment');
    segs.push(seg);
    host = seg;
  }
  // Support rooms beyond the segments' lounges ride in extra lounges.
  for (const s of support.slice(k)) {
    const lo = addLounge(c, host, { ...s, w: Math.max(4, s.w) });
    if (lo === null) return no(c, 'lounge');
    host = lo;
  }
  c.parts.push(`segments ${forms.join('/')}`);
  return stern(c, host) && arms(c, segs, j.guns);
}

/** Stamp a solid truss rectangle into a builder. */
const truss = (b: Builder, x: number, y: number, w: number, h: number, key: string): void => {
  b.cv.stamp(Array.from({ length: h }, () => '='.repeat(w)), x, y, key);
};

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

/** Mining ship: a cockpit, one to three barges of ore hoppers, the drive; the rig fore of the bow or mid-ship. */
function mining(c: Ctx): boolean {
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

/** Station hub in a seeded shape: square (quadrant rooms on a cross corridor), ring, or cross (rooms along arms). */
function hubBlock(c: Ctx, rooms: RoomSpec[]): Block | null {
  const shape = c.rng.pick(['square', 'ring', 'cross'] as const);
  c.parts.push(`hub ${shape}`);
  const [cmd, ...rest] = rooms as [RoomSpec, ...RoomSpec[]];
  if (shape === 'square') return civil(station(c.rng, rooms), 'command', 'station hub');
  if (shape === 'ring') return civil(habitat(c.rng, cmd, rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)), 'command', 'ring hub');
  const arm = Math.max(3, ...rest.map((r) => Math.max(r.w, r.h))) + c.rng.int(0, 2);
  return civil(crossHub(c.rng, cmd, rest, arm), 'command', 'cross hub');
}

/**
 * Station: a hub with two to four arms in seeded directions, an airlock at each arm's end (the east arm, if any, ends
 * in the drive); cargo pods and the habitat ride part-way along arms or straight on free hub faces.
 */
function stationHub(c: Ctx): boolean {
  const j = jobs(c.plan);
  const crew = j.crew.filter((r) => r.role !== 'dock');
  const hubRooms = [c.plan.command, ...j.core.slice(0, 2), ...crew.splice(0, 1)].slice(0, 4);
  const hub = hubBlock(c, hubRooms);
  if (!hub) return no(c, 'hub');
  const root = c.A.placeRoot(hub);
  const faces: Side[] = ['n', 's', 'w', 'e'];
  const dirs = shuffle(c.rng, faces).slice(0, c.rng.int(2, 4));
  const mods: Block[] = [];
  const pods = civil(podString(c.rng, Math.max(4, cratesOf(j.stores))), 'cargo', 'cargo pods');
  if (!pods) return no(c, 'pods');
  mods.push(pods);
  if (crew.length > 0) {
    const hubR = crew.find((r) => r.role === 'support') ?? (crew[0] as RoomSpec);
    const rest = [...crew.filter((r) => r !== hubR), ...j.core.slice(2)];
    const hab = civil(habitat(c.rng, hubR, rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)), 'habitat', 'habitat ring');
    if (!hab) return no(c, 'habitat');
    mods.push(hab);
  }
  // Each module goes on a free hub face or part-way along an arm.
  const onArm = new Map<Side, Block>();
  const onFace = new Map<Side, Block>();
  for (const m of mods) {
    // Never east: the drive keeps that side short, so the station grows no stern.
    const free = faces.filter((f) => f !== 'e' && !dirs.includes(f) && !onFace.has(f));
    const armsFree = dirs.filter((d) => d !== 'e' && !onArm.has(d));
    if (free.length > 0 && (armsFree.length === 0 || c.rng.chance(0.5))) onFace.set(c.rng.pick(free), m);
    else if (armsFree.length > 0) onArm.set(c.rng.pick(armsFree), m);
  }
  // Guns ride the modules (and the square hub, whose faces are corridor ends): never through the hub's rooms.
  const hosts = hub.label.endsWith('station hub') ? [root] : [];
  let eastEnd: number | null = null;
  for (const [f, m] of onFace) {
    const id = join(c, root, m, f);
    if (id === null) return no(c, 'module');
    hosts.push(id);
    if (f === 'e') eastEnd = id;
  }
  for (const d of dirs) {
    const horiz = d === 'w' || d === 'e';
    let tip = join(c, root, hallBlock(c.rng, d === 'e' ? c.rng.int(1, 3) : c.rng.int(2, 5), 1, horiz), d);
    const m = onArm.get(d);
    if (tip !== null && m) {
      const id = join(c, tip, m, d);
      if (id === null) return no(c, 'module');
      hosts.push(id);
      tip = join(c, id, hallBlock(c.rng, c.rng.int(1, 3), 1, horiz), d);
    }
    if (tip === null) return no(c, 'arm');
    if (d === 'e') { eastEnd = tip; continue; }
    const lock = d === 'n' ? dockBlock(c.rng) : d === 's' ? mirrorBlock(dockBlock(c.rng)) : westDock(c.rng);
    if (c.A.attach(tip, lock, { side: d, align: 'mid', doors: 1 }) === null) return no(c, 'airlock');
  }
  c.parts.push(`arms ${dirs.join('')}`);
  return stern(c, eastEnd ?? root) && arms(c, hosts, j.guns);
}

export const CIVIL_GRAMMARS: Record<CivilGrammar, (c: Ctx, f: FactionDef) => boolean> = {
  freighter: (c) => freighter(c), liner: (c) => linerHull(c), mining: (c) => mining(c), station: (c) => stationHub(c),
};
