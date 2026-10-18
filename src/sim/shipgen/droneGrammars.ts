import { mirrorBlock, type Block, type Side } from './arranger';
import { beam, coreRoom, crawl, podSpecs, sealedPod, storeRoom } from './droneBlocks';
import { dockBlock } from './navyBlocks';
import { no, type Ctx } from './navyKit';
import type { RoomSpec } from './plan';
import { depthAt, rollProfile, type Profile } from './profile';
import type { DroneGrammar, FactionDef } from './types';

/**
 * Drone grammars on the shared 2D arranger: machinery first. The structural helpers are the navy's carried over:
 * carriers (beams or crawlways) with SOCKETS at intervals and a PROFILE for strut length, laid out in a FRAME
 * topology drawn once per ship (`frame`), with engines placed by that topology (`tipDrives`, `drive`). Robot
 * crawlways are the only traversal and reach the processing room (the AI core) and the airlock on its face.
 *   picket  compact: the core with pods packed on short sturdy beams (single or cross), a short stub for stores
 *   lancer  a lance fore: single beam, Y fork, twin beams or an H, a flat beam aft, a stern fan or tip engines
 *   swarm   no spine: small crawl nodes in a loose 2D lattice, a few pods each, engines spread over the nodes
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
    // A stern fan: one pod straight off the carrier's end, one out on a strut above and below it (struts long
    // enough that each pod's exhaust clears the others).
    const mid = pod(c, left[0] as RoomSpec);
    if (c.A.attach(from, mid, { side: 'e', align: 'mid', doors: 0, kind: 'graft' }) !== null) left.shift();
    for (const side of ['n', 's'] as const) {
      if (left.length === 0) break;
      const st = c.A.attach(from, beam(c.rng, 6, 1, false), { side, align: 'end', doors: 0, kind: 'beam' });
      const b = pod(c, left[0] as RoomSpec);
      if (st !== null && c.A.attach(st, side === 's' ? mirrorBlock(b) : b, { side, align: 'mid', doors: 0, kind: 'graft' }) !== null) left.shift();
      else if (st !== null) c.A.undoLast();
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
  return drive(c, last, left, 'paired');
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

/** Small stores on a crawl or the core. */
function stores(c: Ctx, on: number, n: number): void {
  for (let i = 0; i < n; i++) if (c.A.attach(on, storeRoom(c.rng, 2), { side: c.rng.chance(0.5) ? 'n' : 's', align: 'any', doors: 1 }) === null) break;
}

/** A carrier of the frame: a beam (or crawl) with the faces pods may ride on, fore-to-aft or bottom-to-top length. */
interface Carrier { id: number; len: number; faces: Side[] }

/** A beam on a face of `host`; `along` lays it across that face instead of out from it (cross pieces, rails). */
const beamOn = (c: Ctx, host: number, side: Side, len: number, thick: number, align: 'start' | 'mid' | 'end' = 'mid', along = false): number | null =>
  c.A.attach(host, beam(c.rng, len, thick, (side === 'e' || side === 'w') !== along), { side, align, doors: 0, kind: 'beam' });

/**
 * The frame: how the beams around the core are laid out. Same blocks, different topology:
 *   single  one beam fore
 *   fork    a stem fore, a cross piece, two prongs reaching forward (a Y)
 *   twin    a cross piece on the core, two parallel beams fore
 *   h       beams up and down from the core carrying two long rails (an H)
 *   cross   short beams fore, up and down
 * Returns the carriers (pods ride on them) and the tips engines can sit on (their aft faces stay clear).
 */
type Topology = 'single' | 'fork' | 'twin' | 'h' | 'cross';

/** The ship's topology, drawn once per ship from the family's weighted set (every candidate shares it). */
function byVariant(c: Ctx, set: [Topology, number][]): Topology {
  const total = set.reduce((t, [, w]) => t + w, 0);
  let r = (c.variant ?? c.rng.next()) * total;
  for (const [t, w] of set) if ((r -= w) < 0) return t;
  return (set[set.length - 1] as [Topology, number])[0];
}

function frame(c: Ctx, core: number, topo: Topology, run: number, thick: number): { carriers: Carrier[]; tips: number[] } | null {
  const sep = c.rng.int(4, 7);
  const out: Carrier[] = [];
  const tips: number[] = [];
  const prongs = (from: number, side: Side): boolean => {
    const cross = beamOn(c, from, side, 2 * sep + thick, 1, 'mid', true);
    if (cross === null) return false;
    for (const a of ['start', 'end'] as const) {
      const pr = beamOn(c, cross, 'w', run, thick, a);
      if (pr === null) return false;
      // Outer faces always; the inner ones too when the prongs stand far enough apart for pods on both.
      const outer: Side = a === 'start' ? 'n' : 's';
      out.push({ id: pr, len: run, faces: sep >= 6 ? [outer, outer === 'n' ? 's' : 'n'] : [outer] });
    }
    tips.push(cross);
    return true;
  };
  if (topo === 'single') {
    const b = beamOn(c, core, 'w', run, thick);
    if (b === null) return null;
    out.push({ id: b, len: run, faces: ['n', 's'] });
  } else if (topo === 'fork') {
    const stem = beamOn(c, core, 'w', c.rng.int(3, 5), thick);
    if (stem === null || !prongs(stem, 'w')) return null;
  } else if (topo === 'twin') {
    if (!prongs(core, 'w')) return null;
  } else if (topo === 'h') {
    for (const side of ['n', 's'] as const) {
      const up = beamOn(c, core, side, sep, 1);
      const rail = up === null ? null : beamOn(c, up, side, 2 * run, thick, 'mid', true);
      if (rail === null) return null;
      out.push({ id: rail, len: 2 * run, faces: [side] });
      tips.push(rail);
    }
  } else {
    const fore = beamOn(c, core, 'w', Math.ceil(run / 2), thick);
    if (fore === null) return null;
    out.push({ id: fore, len: Math.ceil(run / 2), faces: ['n', 's'] });
    for (const side of ['n', 's'] as const) {
      const arm = beamOn(c, core, side, Math.ceil(run / 2), thick);
      if (arm === null) return null;
      out.push({ id: arm, len: Math.ceil(run / 2), faces: ['w'] });
      tips.push(arm);
    }
  }
  c.parts.push(topo);
  return { carriers: out, tips };
}

/** Share the pods out over the carriers' faces by length, then socket each face. */
function load(c: Ctx, carriers: Carrier[], specs: RoomSpec[], p: Profile): boolean {
  const faces = carriers.flatMap((k) => k.faces.map((f) => ({ k, f, list: [] as RoomSpec[], room: k.len })));
  for (const s of specs) {
    const f = faces.reduce((a, b) => (b.room > a.room ? b : a));
    f.list.push(s);
    f.room -= s.w + 3;
  }
  return faces.every((f) => f.list.length === 0 || socketed(c, f.k.id, f.k.len, f.f, f.list, p));
}

/**
 * Engines by topology: one on each tip of the frame (fork cross piece, H rails, cross arms) where the exhaust is
 * clear, the rest at the aft carrier (a pair on its end faces, or a short rail / paired beam). The aft drive goes on
 * first; tip pods then keep clear of it.
 */
function tipDrives(c: Ctx, tips: number[], aft: number, engines: RoomSpec[]): boolean {
  const nTip = Math.min(tips.length, engines.length);
  const rest = engines.slice(nTip);
  const style = rest.length === 2 && c.rng.chance(0.5) ? 'paired' : rest.length >= 2 ? 'railEnd' : c.rng.pick(['rail', 'railEnd'] as const);
  if (!drive(c, aft, rest, style)) return false;
  const left = engines.slice(0, nTip);
  for (const t of tips) {
    if (left.length === 0) break;
    const b = pod(c, left[0] as RoomSpec);
    if (c.A.attach(t, b, { side: 'e', align: 'any', doors: 0, kind: 'graft' }) !== null) left.shift();
  }
  if (nTip > left.length) c.parts.push(`tips ${nTip - left.length}E`);
  // Tips that could not take theirs: on the aft carrier's end faces.
  for (const e of left) {
    const b = pod(c, e);
    if (c.A.attach(aft, b, { side: 'n', align: 'end', doors: 0, kind: 'graft' }) === null && c.A.attach(aft, mirrorBlock(b), { side: 's', align: 'end', doors: 0, kind: 'graft' }) === null) return no(c, 'tip engines');
  }
  return true;
}

/** Picket: the core with a few pods packed on short sturdy beams, stores on a short crawl stub aft, paired drive. */
function spoke(c: Ctx): boolean {
  const { mounts, reactors, engines } = podSpecs(c.plan, c.defs);
  const all = [...mounts, ...reactors];
  const core = c.A.placeRoot(coreRoom(c.rng, c.plan, 7, 4));
  const p = rollProfile(() => c.rng.next(), 0, c.rng.int(0, 1), [0.3, 0.7]);
  const topo: Topology = all.length > 5 ? 'cross' : byVariant(c, [['single', 2], ['cross', 1]]);
  const f = frame(c, core, topo, runOf(all.length > 5 ? all.slice(0, Math.ceil(all.length / 3)) : all), 2);
  if (!f || !load(c, f.carriers, all, p)) return no(c, 'picket frame');
  // A short crawl stub aft for the stores and the airlock; the drive behind it.
  const stub = c.A.attach(core, crawl(c.rng, Math.max(3, 3 * c.plan.cargo.length), true), { side: 'e', doors: 1 });
  if (stub === null) return no(c, 'stub');
  stores(c, stub, c.plan.cargo.length);
  if (!dock(c, [stub, core])) return false;
  return tipDrives(c, f.tips, stub, engines);
}

/** Lancer: guns forward on a single lance, a Y fork, twin beams or an H; the rest on a beam aft. */
function truss(c: Ctx): boolean {
  const { mounts, reactors, engines } = podSpecs(c.plan, c.defs);
  const core = c.A.placeRoot(coreRoom(c.rng, c.plan, 7, 4));
  if (!dock(c, [core])) return false;
  const guns = mounts.filter((m) => m.role === 'weapons');
  const other = [...mounts.filter((m) => m.role !== 'weapons'), ...reactors];
  const thick = c.rng.int(1, 2);
  const head = rollProfile(() => c.rng.next(), 0, c.rng.int(1, 4), [0.15, 0.6]);
  const topo = byVariant(c, [['single', 2], ['fork', 2], ['twin', 2], ['h', 1]]);
  const forked = topo === 'fork' || topo === 'twin' || topo === 'h';
  const f = guns.length > 0 ? frame(c, core, topo, runOf(guns, 3) / (forked ? 2 : 1) + 4, thick) : { carriers: [], tips: [] };
  if (!f) return no(c, `frame ${topo}`);
  if (!load(c, f.carriers, guns, head)) return no(c, `load ${topo}`);
  const al = runOf(other);
  const aft = c.A.attach(core, beam(c.rng, al, thick, true), { side: 'e', doors: 0, kind: 'beam' });
  if (aft === null) return no(c, 'aft truss');
  // Engines before the aft pods: the pods then find sockets clear of the exhaust.
  if (!tipDrives(c, f.tips, aft, engines)) return false;
  return bothSides(c, aft, al, other, rollProfile(() => c.rng.next(), 0, 1)) || no(c, 'aft pods');
}

/**
 * Swarm: no spine. Many small crawl nodes linked in a loose lattice (each new node off a random earlier one, up,
 * down or aft), a few pods socketed on each, an engine pod on nodes where the exhaust is clear.
 */
function cluster(c: Ctx): boolean {
  const { mounts, reactors, engines } = podSpecs(c.plan, c.defs);
  const all = [...mounts, ...reactors];
  const core = c.A.placeRoot(coreRoom(c.rng, c.plan, 7, 4));
  if (!dock(c, [core])) return false;
  const p = rollProfile(() => c.rng.next(), 0, c.rng.int(1, 2), [0.3, 0.7]);
  const per = c.rng.int(1, 2);
  const nodes: number[] = [core];
  let placed = 0;
  for (let guard = 0; placed < all.length && guard < 40; guard++) {
    const list = all.slice(placed, placed + per);
    // Any earlier node, any face but the core's bow: the lattice grows in two dimensions, never a spine.
    const from = c.rng.pick(nodes);
    const side = c.rng.pick(from === core ? (['n', 's', 'e'] as const) : (['n', 's', 'e', 'w'] as const));
    const vertical = side === 'n' || side === 's';
    const link = c.A.attach(from, crawl(c.rng, c.rng.int(1, 2), !vertical), { side, align: 'any', doors: 1 });
    if (link === null) continue;
    const len = runOf(list);
    const node = c.A.attach(link, crawl(c.rng, len, true), { side, align: vertical ? c.rng.pick(['start', 'end'] as const) : 'mid', doors: 1 });
    if (node === null) { c.A.undoLast(); continue; }
    if (!bothSides(c, node, len, list, p)) return no(c, 'node');
    nodes.push(node);
    placed += list.length;
  }
  if (placed < all.length) return no(c, 'lattice');
  stores(c, nodes[1] ?? core, c.plan.cargo.length);
  c.parts.push(`lattice ${nodes.length - 1}`);
  const aft = nodes.reduce((a, b) => (c.A.bounds(b).x > c.A.bounds(a).x ? b : a));
  return distributed(c, nodes.slice(1), aft, engines);
}

export const DRONE_GRAMMARS: Record<DroneGrammar, (c: Ctx, f: FactionDef) => boolean> = { spoke: (c) => spoke(c), truss: (c) => truss(c), cluster: (c) => cluster(c) };
