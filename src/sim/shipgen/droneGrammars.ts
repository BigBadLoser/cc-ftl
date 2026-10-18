import { mirrorBlock, type Block, type Side } from './arranger';
import { beam, coreRoom, crawl, podSpecs, sealedPod, storeRoom } from './droneBlocks';
import { dockBlock } from './navyBlocks';
import { no, type Ctx } from './navyKit';
import type { RoomSpec } from './plan';
import { depthAt, rollProfile, type Profile } from './profile';
import type { DroneGrammar, FactionDef } from './types';

/**
 * Drone grammars on the shared 2D arranger: machinery first. The structural components are the navy's carried over:
 * a carrier (beam or crawlway) with SOCKETS at intervals along it, and a PROFILE that sets the strut length at each
 * socket, so a truss carries its pods in a designed outline with the beam visible between them. Robot crawlways are
 * the only traversal and reach the processing room (the AI core) and the airlock.
 *   picket  compact: the core with a short socketed beam fore, paired thrusters aft; no crawl arms when small
 *   lancer  a long beam fore with gun pods on profiled struts (a lance head), a second beam aft, rail-end engines
 *   swarm   repeated crawl nodes with the same pods, an engine pod on each node (distributed drive)
 */

const pod = (c: Ctx, s: RoomSpec): Block => sealedPod(c.rng, s.role === 'engine' ? 'engine pod' : s.role === 'reactor' ? 'reactor bank' : `${s.role} pod`, s);
const podLen = (b: Block, side: Side): number => (side === 'e' || side === 'w' ? b.rows.length : Math.max(...b.rows.map((r) => r.length))) - 2;

/** Mount a pod on a side of `parent`, at socket offset `at` (or anywhere), directly or out on a beam strut. */
function mount(c: Ctx, parent: number, side: Side, p: Block, strut: number, at?: number): number | null {
  const place = at === undefined ? { align: 'any' as const } : { align: 'start' as const, shift: at };
  const turned = side === 's' ? mirrorBlock(p) : p;
  if (strut <= 0) return c.A.attach(parent, turned, { side, ...place, doors: 0, kind: 'graft' });
  const horiz = side === 'e' || side === 'w';
  const b = c.A.attach(parent, beam(c.rng, strut + 2, 1, horiz), { side, ...place, doors: 0, kind: 'beam' });
  return b === null ? null : c.A.attach(b, turned, { side, align: 'mid', doors: 0, kind: 'beam' });
}

/**
 * Pods on sockets along one side of a carrier `len` tiles long: evenly spaced (the carrier shows between them),
 * struts from the profile at each socket. Falls back to any free spot on the carrier.
 */
function socketed(c: Ctx, host: number, len: number, side: Side, specs: RoomSpec[], p: Profile): boolean {
  const blocks = specs.map((s) => pod(c, s));
  const used = blocks.reduce((t, b) => t + podLen(b, side), 0);
  const gap = Math.max(0, Math.floor((len - used) / (blocks.length + 1)));
  let x = gap;
  for (const b of blocks) {
    const t = len > 1 ? (x + podLen(b, side) / 2) / len : 0.5;
    const strut = depthAt(p, t);
    if (mount(c, host, side, b, strut, x) === null && mount(c, host, side, b, strut) === null && mount(c, host, side, b, 0) === null) return no(c, `socket ${side}`);
    x += podLen(b, side) + gap;
  }
  return true;
}

/** Mirrored halves (balanced mounts) or a seeded lopsided split. */
const split = <T>(c: Ctx, xs: T[], mirror: boolean): [T[], T[]] => {
  if (mirror) return [xs.filter((_, i) => i % 2 === 0), xs.filter((_, i) => i % 2 === 1)];
  const a: T[] = [];
  const b: T[] = [];
  for (const x of xs) (c.rng.chance(0.6) ? a : b).push(x);
  return [a, b];
};

/** Both sides of a carrier, one profile. */
const bothSides = (c: Ctx, host: number, len: number, specs: RoomSpec[], p: Profile, mirror = true): boolean => {
  const [n, s] = split(c, specs, mirror);
  return socketed(c, host, len, 'n', n, p) && socketed(c, host, len, 's', s, p);
};

/** Carrier length for pods split over two sides, with `gap` tiles of carrier showing between them. */
const runOf = (xs: RoomSpec[], gap = 2): number => Math.max(4, Math.ceil(xs.reduce((t, x) => t + x.w + 2 + gap, gap) / 2));

/**
 * Engines, always facing +x, never one tall column:
 *   rail     a short vertical beam aft, the pods on sockets along it with the beam showing between them
 *   paired   two thruster groups at the ends of a cross beam, a wide gap between them
 *   railEnd  a pair on the carrier's own end (both faces), the rest on a rail
 */
function drive(c: Ctx, from: number, engines: RoomSpec[], style: 'rail' | 'paired' | 'railEnd'): boolean {
  if (engines.length === 0) return true;
  const left = [...engines];
  if (style === 'railEnd') {
    // One pod on each face of the carrier's aft end (a pair either side of the beam).
    for (const side of ['n', 's'] as const) {
      const b = pod(c, left[0] as RoomSpec);
      if (left.length > 1 && c.A.attach(from, side === 's' ? mirrorBlock(b) : b, { side, align: 'end', doors: 0, kind: 'graft' }) !== null) left.shift();
    }
    c.parts.push(`rail-end ${engines.length - left.length}E`);
    if (left.length === 0) return true;
  }
  const k = left.length;
  const gap = style === 'paired' && k >= 2 ? c.rng.int(3, 6) : c.rng.int(1, 2);
  const at: number[] = [];
  if (style === 'paired' && k >= 2) {
    // Two groups, packed at either end of the beam.
    const a = Math.ceil(k / 2);
    for (let i = 0; i < a; i++) at.push(1 + i * 6);
    for (let i = a; i < k; i++) at.push(1 + i * 6 + gap);
  } else for (let i = 0; i < k; i++) at.push(gap + i * (6 + gap));
  const len = (at[at.length - 1] as number) + 6 + (style === 'paired' ? 1 : gap);
  const cross = c.A.attach(from, beam(c.rng, len, 1, false), { side: 'e', align: 'mid', doors: 0, kind: 'beam' });
  if (cross === null) return no(c, 'drive beam');
  c.parts.push(`${style === 'railEnd' ? 'rail' : style} ${k}E`);
  for (const [i, e] of left.entries()) {
    const b = pod(c, e);
    if (c.A.attach(cross, b, { side: 'e', align: 'start', shift: at[i] as number, doors: 0, kind: 'graft' }) === null && c.A.attach(cross, b, { side: 'e', align: 'any', doors: 0, kind: 'graft' }) === null) return no(c, 'engine pod');
  }
  return true;
}

/** One engine pod per node where its exhaust is clear (distributed drive); the rest on a rail aft of `last`. */
function distributed(c: Ctx, nodes: number[], last: number, engines: RoomSpec[]): boolean {
  const left = [...engines];
  for (const n of [...nodes].reverse()) {
    for (const side of c.rng.chance(0.5) ? (['n', 's'] as const) : (['s', 'n'] as const)) {
      if (left.length === 0) break;
      const b = pod(c, left[0] as RoomSpec);
      if (c.A.attach(n, side === 's' ? mirrorBlock(b) : b, { side, align: 'end', doors: 0, kind: 'graft' }) !== null) { left.shift(); break; }
    }
  }
  c.parts.push(`distributed ${engines.length - left.length}E`);
  return drive(c, last, left, 'rail');
}

/** Docking port straight on the core (or a crawl) face: no antenna tube. */
function dock(c: Ctx, hosts: number[]): boolean {
  for (const h of hosts) {
    for (const side of ['n', 's'] as const) {
      const d = side === 'n' ? dockBlock(c.rng) : mirrorBlock(dockBlock(c.rng));
      if (c.A.attach(h, d, { side, align: 'any', doors: 1 }) !== null) return true;
    }
  }
  return no(c, 'dock');
}

/** Small stores on a crawl. */
function stores(c: Ctx, on: number, n: number): void {
  for (let i = 0; i < n; i++) if (c.A.attach(on, storeRoom(c.rng, 2), { side: c.rng.chance(0.5) ? 'n' : 's', align: 'any', doors: 1 }) === null) break;
}

/** Picket: the core, a short beam fore with everything socketed on it, paired thrusters aft; a crawl spine only when big. */
function spoke(c: Ctx, f: FactionDef): boolean {
  const { mounts, reactors, engines } = podSpecs(c.plan, c.defs);
  const all = [...mounts, ...reactors];
  const mirror = c.rng.chance(f.architecture.symmetry);
  const core = c.A.placeRoot(coreRoom(c.rng, c.plan, 7, 4));
  // Pickets are compact: pods hug a sturdy beam (struts of 0 to 1).
  const p = rollProfile(() => c.rng.next(), 0, c.rng.int(0, 1), [0.3, 0.7]);
  const fore = all.length <= 4 ? all : all.slice(0, Math.ceil(all.length / 2));
  const aft = all.slice(fore.length);
  const len = runOf(fore);
  const fb = c.A.attach(core, beam(c.rng, len, 2, true), { side: 'w', doors: 0, kind: 'beam' });
  if (fb === null || !bothSides(c, fb, len, fore, p, mirror)) return no(c, 'fore beam');
  c.parts.push(mirror ? 'picket mirrored' : 'picket', `beam ${fore.length}`);
  // Bigger pickets carry the rest on a short crawl spine aft (stores and the airlock on it too).
  let tail = core;
  if (aft.length > 0 || c.plan.cargo.length > 0) {
    const al = runOf(aft);
    const spine = c.A.attach(core, crawl(c.rng, al, true), { side: 'e', doors: 1 });
    if (spine === null || (aft.length > 0 && !bothSides(c, spine, al, aft, p, mirror))) return no(c, 'aft spine');
    stores(c, spine, c.plan.cargo.length);
    c.parts.push(`spine ${aft.length}`);
    tail = spine;
  }
  if (!dock(c, [core, tail])) return false;
  return drive(c, tail, engines, 'paired');
}

/** Lancer: a long beam fore with the guns on profiled struts (a lance head), a beam aft with the rest, rail engines. */
function truss(c: Ctx): boolean {
  const { mounts, reactors, engines } = podSpecs(c.plan, c.defs);
  const core = c.A.placeRoot(coreRoom(c.rng, c.plan, 7, 4));
  if (!dock(c, [core])) return false;
  const guns = mounts.filter((m) => m.role === 'weapons');
  const other = [...mounts.filter((m) => m.role !== 'weapons'), ...reactors];
  const thick = c.rng.int(1, 2);
  // The lance head: struts longest a little aft of the tip, short at the core.
  const head = rollProfile(() => c.rng.next(), 0, c.rng.int(1, 4), [0.15, 0.6]);
  const flat = rollProfile(() => c.rng.next(), 0, 1, [0.3, 0.7]);
  if (guns.length > 0) {
    const fl = runOf(guns, 3);
    const fore = c.A.attach(core, beam(c.rng, fl, thick, true), { side: 'w', doors: 0, kind: 'beam' });
    if (fore === null || !bothSides(c, fore, fl, guns, head, c.rng.chance(0.6))) return no(c, 'fore truss');
  }
  const al = runOf(other);
  const aft = c.A.attach(core, beam(c.rng, al, thick, true), { side: 'e', doors: 0, kind: 'beam' });
  if (aft === null || !bothSides(c, aft, al, other, flat)) return no(c, 'aft truss');
  c.parts.push(`lance ${guns.length}+${other.length}`);
  return drive(c, aft, engines, c.rng.pick(['railEnd', 'railEnd', 'rail', 'paired'] as const));
}

/** Swarm: repeated crawl nodes carrying the same pods on sockets, linked on a zigzag, an engine on each node. */
function cluster(c: Ctx): boolean {
  const { mounts, reactors, engines } = podSpecs(c.plan, c.defs);
  const all = [...mounts, ...reactors];
  const k = Math.max(2, Math.min(4, 2 + Math.floor(c.plan.size / 2)));
  const per = Math.ceil(all.length / k);
  const core = c.A.placeRoot(coreRoom(c.rng, c.plan, 7, 4));
  if (!dock(c, [core])) return false;
  const p = rollProfile(() => c.rng.next(), 1, c.rng.int(1, 3), [0.3, 0.7]);
  let prev = core;
  const nodes: number[] = [];
  for (let i = 0; i < k; i++) {
    const list = all.slice(i * per, (i + 1) * per);
    if (list.length === 0) break;
    const turn = i > 0 && c.rng.chance(0.5) ? (c.rng.chance(0.5) ? 'n' : 's') : 'e';
    const link = turn === 'e' ? c.A.attach(prev, crawl(c.rng, c.rng.int(2, 4), true), { side: 'e', doors: 1 }) : c.A.attach(prev, crawl(c.rng, c.rng.int(3, 6), false), { side: turn, align: 'end', doors: 1 });
    if (link === null) return no(c, 'link');
    nodes.push(link);
    const len = runOf(list);
    const node = c.A.attach(link, crawl(c.rng, len, true), { side: turn, align: turn === 'e' ? 'mid' : 'start', doors: 1 });
    if (node === null || !bothSides(c, node, len, list, p)) return no(c, 'node');
    if (i === 0) stores(c, node, c.plan.cargo.length);
    c.parts.push(`cluster ${list.length}${turn === 'e' ? '' : ` ${turn}`}`);
    nodes.push(node);
    prev = node;
  }
  return distributed(c, nodes, prev, engines);
}

export const DRONE_GRAMMARS: Record<DroneGrammar, (c: Ctx, f: FactionDef) => boolean> = { spoke, truss: (c) => truss(c), cluster: (c) => cluster(c) };
