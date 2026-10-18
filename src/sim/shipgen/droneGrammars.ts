import { mirrorBlock, type Block, type Side } from './arranger';
import { beam, coreRoom, crawl, podSpecs, sealedPod, storeRoom } from './droneBlocks';
import { dockBlock } from './navyBlocks';
import { no, type Ctx } from './navyKit';
import type { RoomSpec } from './plan';
import type { DroneGrammar, FactionDef } from './types';

/**
 * Drone grammars on the shared 2D arranger: machinery first. Sealed pods (guns, PD, shields, reactor banks, engines)
 * ride on crawlways and solid beams; robot crawlways (one tile) are the only traversal and reach the processing room
 * (the AI core: boarding target and capture point) and the airlock. Pods repeat in clusters; mirrored only when the
 * policy rolls balanced mounts.
 */

const pod = (c: Ctx, s: RoomSpec): Block => sealedPod(c.rng, s.role === 'engine' ? 'engine pod' : s.role === 'reactor' ? 'reactor bank' : `${s.role} pod`, s);

/** Mount a pod on a side of `parent`, directly or out on a beam strut (`strut` tiles). Returns the pod id. */
function mount(c: Ctx, parent: number, side: Side, p: Block, strut: number): number | null {
  if (strut <= 0) return c.A.attach(parent, p, { side, align: 'any', doors: 0, kind: 'graft' });
  const horiz = side === 'e' || side === 'w';
  const bm = beam(c.rng, strut + 2, c.rng.int(1, 2), horiz);
  const b = c.A.attach(parent, bm, { side, align: 'any', doors: 0, kind: 'beam' });
  if (b === null) return null;
  const id = c.A.attach(b, p, { side, align: 'mid', doors: 0, kind: 'beam' });
  return id;
}

/** Mount pods on two opposite sides of a block (n/s or mirrored pairs). */
function mountAll(c: Ctx, host: number, specs: RoomSpec[], side: Side, strut: () => number): boolean {
  for (const s of specs) {
    let ok = false;
    for (let t = 0; t < 3 && !ok; t++) ok = mount(c, host, side, pod(c, s), strut()) !== null;
    if (!ok) return no(c, `mount ${s.role}`);
  }
  return true;
}

/** An engine rail: a vertical crawlway east of `from`, engine pods on its east side (they face +x). */
function engineRail(c: Ctx, from: number, engines: RoomSpec[]): boolean {
  const link = c.A.attach(from, crawl(c.rng, c.rng.int(1, 3), true), { side: 'e', doors: 1 });
  if (link === null) return no(c, 'drive link');
  const rail = c.A.attach(link, crawl(c.rng, Math.max(4, 5 * engines.length), false), { side: 'e', align: 'mid', doors: 1 });
  if (rail === null) return no(c, 'drive rail');
  for (const e of engines) if (c.A.attach(rail, pod(c, e), { side: 'e', align: 'any', doors: 0, kind: 'graft' }) === null) return no(c, 'engine pod');
  c.parts.push(`rail ${engines.length}E`);
  return true;
}

/** Docking port on a crawlway side: the boarders' way in. */
const dock = (c: Ctx, on: number): boolean => {
  for (const side of ['n', 's'] as const) {
    const d = side === 'n' ? dockBlock(c.rng) : mirrorBlock(dockBlock(c.rng));
    if (c.A.attach(on, d, { side, align: 'any', doors: 1 }) !== null) return true;
  }
  return no(c, 'dock');
};

const split = <T>(c: Ctx, xs: T[], mirror: boolean): [T[], T[]] => {
  if (mirror) return [xs.filter((_, i) => i % 2 === 0), xs.filter((_, i) => i % 2 === 1)];
  const a: T[] = [];
  const b: T[] = [];
  for (const x of xs) (c.rng.chance(0.6) ? a : b).push(x);
  return [a, b];
};

/** Spoke: the processing room at the centre, crawl spokes to pod clusters, reactors west, engines east. */
function spoke(c: Ctx, f: FactionDef): boolean {
  const { mounts, reactors, engines } = podSpecs(c.plan, c.defs);
  const mirror = c.rng.chance(f.architecture.symmetry);
  const core = c.A.placeRoot(coreRoom(c.rng, c.plan, 7, 4));
  c.parts.push(mirror ? 'spoke mirrored' : 'spoke');
  const [n, s] = split(c, mounts, mirror);
  const strut = (): number => c.rng.int(0, 2);
  for (const [side, list] of [['n', n], ['s', s]] as const) {
    if (list.length === 0) continue;
    const arm = c.A.attach(core, crawl(c.rng, c.rng.int(2, 4), false), { side, doors: 1 });
    if (arm === null) return no(c, 'spoke');
    const node = c.A.attach(arm, crawl(c.rng, Math.max(4, list.reduce((t, x) => t + x.w + 1, 0)), true), { side, align: 'mid', doors: 1 });
    if (node === null) return no(c, 'node');
    if (!mountAll(c, node, list, side, strut)) return false;
    c.parts.push(`cluster ${side} ${list.length}`);
  }
  const west = c.A.attach(core, crawl(c.rng, Math.max(3, reactors.reduce((t, x) => t + x.w + 1, 0)), true), { side: 'w', doors: 1 });
  if (west === null) return no(c, 'west arm');
  const [rn, rs] = split(c, reactors, true);
  if (!mountAll(c, west, rn, 'n', () => c.rng.int(0, 1)) || !mountAll(c, west, rs, 's', () => c.rng.int(0, 1))) return false;
  for (let i = 0; i < c.plan.cargo.length; i++) if (c.A.attach(west, storeRoom(c.rng, 2), { side: c.rng.chance(0.5) ? 'n' : 's', align: 'any', doors: 1 }) === null) break;
  if (!dock(c, west)) return false;
  return engineRail(c, core, engines);
}

/** Truss: the processing room carries a long beam truss aft with pods riding on it; a fore truss for the guns. */
function truss(c: Ctx): boolean {
  const { mounts, reactors, engines } = podSpecs(c.plan, c.defs);
  const core = c.A.placeRoot(coreRoom(c.rng, c.plan));
  const tube = c.A.attach(core, crawl(c.rng, c.rng.int(3, 6), false), { side: c.rng.chance(0.5) ? 'n' : 's', doors: 1 });
  if (tube === null || !dock(c, tube)) return no(c, 'tube');
  const guns = mounts.filter((m) => m.role === 'weapons');
  const other = [...mounts.filter((m) => m.role !== 'weapons'), ...reactors];
  const len = (xs: RoomSpec[]): number => Math.max(6, Math.ceil(xs.reduce((t, x) => t + x.w + 1, 0) / 2) + 2);
  const thick = c.rng.int(1, 2);
  const fore = guns.length > 0 ? c.A.attach(core, beam(c.rng, len(guns), thick, true), { side: 'w', doors: 0, kind: 'beam' }) : null;
  if (guns.length > 0 && fore === null) return no(c, 'fore truss');
  const aft = c.A.attach(core, beam(c.rng, len(other), thick, true), { side: 'e', doors: 0, kind: 'beam' });
  if (aft === null) return no(c, 'aft truss');
  c.parts.push(`truss ${thick}`);
  const [gn, gs] = split(c, guns, c.rng.chance(0.5));
  const [on, os] = split(c, other, true);
  // Mounts ride the truss on short struts: the truss stays visible between them.
  const struts = (): number => c.rng.int(0, 2);
  if (fore !== null && (!mountAll(c, fore, gn, 'n', struts) || !mountAll(c, fore, gs, 's', struts))) return false;
  if (!mountAll(c, aft, on, 'n', struts) || !mountAll(c, aft, os, 's', struts)) return false;
  // Engines on a cross beam at the aft end of the truss.
  const cross = c.A.attach(aft, beam(c.rng, Math.max(4, 5 * engines.length), thick, false), { side: 'e', align: 'mid', doors: 0, kind: 'beam' });
  if (cross === null) return no(c, 'cross beam');
  for (const e of engines) if (c.A.attach(cross, pod(c, e), { side: 'e', align: 'any', doors: 0, kind: 'graft' }) === null) return no(c, 'engine pod');
  c.parts.push(`cross ${engines.length}E`);
  return true;
}

/** Clusters: repeated pod clusters (a crawl node with the same pods), linked by crawl tubes on a zigzag. */
function cluster(c: Ctx): boolean {
  const { mounts, reactors, engines } = podSpecs(c.plan, c.defs);
  const all = [...mounts, ...reactors];
  const k = Math.max(2, Math.min(4, 2 + Math.floor(c.plan.size / 2)));
  const per = Math.ceil(all.length / k);
  const core = c.A.placeRoot(coreRoom(c.rng, c.plan));
  let prev = c.A.attach(core, crawl(c.rng, c.rng.int(2, 3), true), { side: 'e', doors: 1 });
  if (prev === null) return no(c, 'tube');
  if (!dock(c, prev)) return false;
  const strut = (): number => c.rng.int(1, 3);
  for (let i = 0; i < k; i++) {
    const list = all.slice(i * per, (i + 1) * per);
    if (list.length === 0) break;
    // Links leave a node east, or turn north / south for the next cluster.
    const turn = i > 0 && c.rng.chance(0.5) ? (c.rng.chance(0.5) ? 'n' : 's') : 'e';
    const link = turn === 'e' ? c.A.attach(prev, crawl(c.rng, c.rng.int(2, 4), true), { side: 'e', doors: 1 }) : c.A.attach(prev, crawl(c.rng, c.rng.int(3, 6), false), { side: turn, align: 'end', doors: 1 });
    if (link === null) return no(c, 'link');
    const node = c.A.attach(link, crawl(c.rng, Math.max(4, Math.ceil(list.reduce((t, x) => t + x.w + 1, 0) / 2) + 1), true), { side: turn, align: turn === 'e' ? 'mid' : 'start', doors: 1 });
    if (node === null) return no(c, 'node');
    const [n, s] = split(c, list, true);
    if (!mountAll(c, node, n, 'n', strut) || !mountAll(c, node, s, 's', strut)) return false;
    c.parts.push(`cluster ${list.length}${turn === 'e' ? '' : ` ${turn}`}`);
    prev = node;
  }
  return engineRail(c, prev, engines);
}

export const DRONE_GRAMMARS: Record<DroneGrammar, (c: Ctx, f: FactionDef) => boolean> = { spoke, truss: (c) => truss(c), cluster: (c) => cluster(c) };
