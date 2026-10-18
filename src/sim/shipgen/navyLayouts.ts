import { Arranger, mirrorBlock, type Block } from './arranger';
import { Builder } from './builder';
import { bandBlock, bankBlock, clusterBlock, dockBlock, enclosedBlock, noseBlock, podBlock, powerBlock, type SectionOpts } from './navyBlocks';
import { engineSpec, shuffle, type RoomSpec, type ShipPlan } from './plan';
import type { Rng } from '../rng';
import { blockFrom, hallBlock, localBuilder } from './blocks';
import { pairUp, pickNose } from './topoNavy';
import type { FactionDef, HullFamilyDef, SectionKind } from './types';

/**
 * Navy hull grammars on the generic 2D arranger. All use the same standard sections; each family arranges them its
 * own way: linear (corvette), spine with wings side by side (frigate), twin hulls flanking a citadel (cruiser), a
 * hangar block with an offset island and outrigger nacelles (carrier). Propulsion configurations are shared.
 */

interface SectionPlan {
  kind: SectionKind;
  top: RoomSpec[];
  bottom: RoomSpec[];
  sponson: boolean;
  centre?: RoomSpec[];
  extra?: [RoomSpec[], RoomSpec[]];
}

interface Ctx {
  rng: Rng;
  fam: HullFamilyDef;
  plan: ShipPlan;
  A: Arranger;
  depth: Partial<Record<SectionKind, number>>;
  parts: string[];
  /** Why the arrangement failed (for the viewer's rejection notes). */
  why: string;
}

const no = (c: Ctx, why: string): false => { c.why ||= why; return false; };

function sectionsOf(rng: Rng, fam: HullFamilyDef, plan: ShipPlan): SectionPlan[] {
  const out: SectionPlan[] = [];
  const [gn, gs] = pairUp(plan.weapons);
  for (let i = 0; i < gn.length;) {
    const cols = rng.int(fam.batteryCols[0], fam.batteryCols[1]);
    out.push({ kind: 'battery', top: gn.slice(i, i + cols), bottom: gs.slice(i, i + cols), sponson: rng.chance(fam.sponsonChance) });
    i += cols;
  }
  const group = (kind: SectionKind, specs: RoomSpec[]): void => {
    const [n, s] = pairUp(specs);
    const parts = Math.ceil(n.length / Math.max(1, fam.sectionRooms));
    for (let k = 0; k < parts; k++) {
      const a = Math.floor((k * n.length) / parts);
      const z = Math.floor(((k + 1) * n.length) / parts);
      out.push({ kind, top: n.slice(a, z), bottom: s.slice(a, z), sponson: false });
    }
  };
  const core = [...(plan.core ? [plan.core] : []), ...plan.shields];
  const crew = [...plan.quarters, ...plan.support];
  if (fam.merge) group('core', [...core, ...crew, ...plan.cargo]);
  else {
    if (fam.citadel && core.length > 0) out.push({ kind: 'core', top: [], bottom: [], sponson: false, centre: core, extra: pairUp(crew.splice(0, 4)) });
    else group('core', core);
    group('habitat', crew);
    group('cargo', plan.cargo);
  }
  if (plan.hangars.length > 0) out.push({ kind: 'hangar', top: [], bottom: [], sponson: false, centre: plan.hangars, extra: [[], []] });
  return out;
}

/** Build a section block, raising its kind's depth until its rooms fit. */
function section(c: Ctx, sp: SectionPlan, o: Omit<SectionOpts, 'depth'> = {}): Block | null {
  for (let t = 0; t < 4; t++) {
    const depth = c.depth[sp.kind] ?? 3;
    const blk = sp.centre ? enclosedBlock(c.rng, sp.kind, sp.centre, sp.extra ?? [[], []], { ...o, depth }) : bandBlock(c.rng, sp.kind, sp.top, sp.bottom, { ...o, depth, sponson: sp.sponson });
    if (blk) return blk;
    c.depth[sp.kind] = depth + 1;
  }
  return null;
}

/** Engine room entered from the west, on the axis rows (a pod at the end of a wing or hull). */
function endPod(rng: Rng, k: number): Block {
  const b = localBuilder(rng);
  const e = engineSpec(k, 'w');
  b.place({ x: 0, y: -1 - 2 * k, w: e.w + 2, h: e.h + 2 }, 'engine', e);
  return blockFrom(b, 'drive', `pod ${k}E`, 'human', [{ id: 'w', side: 'w', x: 0, y: -1, len: 2, access: 'human' }]);
}

/**
 * Docks (airlocks) grafted on outer room walls of the first host that takes them: mirrored on (host, mirror host)
 * pairs; a lone dock only when `lone` (asymmetric hulls).
 */
function docks(c: Ctx, hosts: [number, number][], lone = false): boolean {
  const d = dockBlock(c.rng);
  for (const [h, m] of hosts) {
    for (const p of c.A.free(h, 'n')) {
      if (!p.id.startsWith('r')) continue;
      if (c.A.attachMirrored(h, m, d, { side: 'n', parentPort: p.id, align: 'any', kind: 'graft', doors: 1 })) return true;
    }
  }
  if (!lone) return false;
  for (const [h] of hosts) for (const p of c.A.free(h, 'n')) if (c.A.attach(h, d, { side: 'n', parentPort: p.id, align: 'any', kind: 'graft', doors: 1 }) !== null) return true;
  return false;
}

const self = (ids: number[]): [number, number][] => ids.map((i) => [i, i]);
const allIds = (c: Ctx): number[] => [...Array(c.A.placed.length).keys()];

/** Propulsion at the aft end of block `aft` (on the axis). Returns false if it does not fit. */
function propulsion(c: Ctx, aft: number, mode: HullFamilyDef['propulsion'][number]): boolean {
  const { rng, plan, A } = c;
  const E = plan.engines;
  c.parts.push(mode);
  if (mode === 'bank') { const b = bankBlock(rng, E, plan.reactors); return !!b && A.attach(aft, b, { side: 'e' }) !== null; }
  if (mode === 'cluster') { const b = clusterBlock(rng, E, plan.reactors); return !!b && A.attach(aft, b, { side: 'e' }) !== null; }
  const pw = powerBlock(rng, plan.reactors);
  const p = pw ? A.attach(aft, pw, { side: 'e' }) : null;
  if (p === null) return false;
  const k = Math.ceil(E / 2);
  if (mode === 'nacelles') {
    const arm = A.attachMirrored(p, p, hallBlock(rng, rng.int(2, 5), 1, false), { side: 'n', parentPort: 'hn', doors: 1 });
    return !!arm && !!A.attachMirrored(arm[0], arm[1], podBlock(rng, k), { side: 'n', doors: 1 });
  }
  // sideDrives / wingPods without wings: engine pods on the power section's outer walls, overhanging aft.
  for (const port of A.free(p, 'n')) {
    if (A.attachMirrored(p, p, podBlock(rng, k), { side: 'n', parentPort: port.id, align: 'end', doors: 1 })) return true;
  }
  return false;
}

/** Chain sections fore to aft from block `from`; returns the last block id. */
function chain(c: Ctx, from: number, secs: SectionPlan[]): number | null {
  let prev = from;
  for (const sp of secs) {
    const blk = section(c, sp);
    const id = blk ? c.A.attach(prev, blk, { side: 'e' }) : null;
    if (id === null) return null;
    c.parts.push(sp.kind);
    prev = id;
  }
  return prev;
}

/** Constraint-scored fore-to-aft order with seeded slack. */
function order(rng: Rng, mid: SectionPlan[]): SectionPlan[] {
  let best = mid;
  let bestScore = -Infinity;
  for (let t = 0; t < 12; t++) {
    const o = shuffle(rng, [...mid]);
    let score = rng.next() * 2;
    o.forEach((s, i) => {
      const pos = o.length > 1 ? i / (o.length - 1) : 0.5;
      if (s.kind === 'cargo' || s.kind === 'habitat') score += pos * 2;
      if (s.kind === 'battery' && o[i + 1]?.kind === 'battery') score -= 2.5;
    });
    if (o[0]?.kind === 'battery') score += 1.5;
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

function linear(c: Ctx, f: FactionDef): boolean {
  const front = noseBlock(c.rng, pickNose(new Builder(c.rng), f, c.plan));
  if (!front) return false;
  const root = c.A.placeRoot(front);
  const last = chain(c, root, order(c.rng, sectionsOf(c.rng, c.fam, c.plan)));
  if (last === null) return no(c, 'chain');
  if (!propulsion(c, last, c.rng.pick(c.fam.propulsion))) return no(c, 'propulsion');
  return docks(c, self(allIds(c).slice(1))) || no(c, 'docks');
}

/** Wings: two mirrored side blocks, from one list of rooms (each wing its own half, same outline). */
function wingPair(c: Ctx, kind: SectionKind, specs: RoomSpec[], hatch: 'n' | 's'): [Block, Block] | null {
  const [p, q] = pairUp(specs);
  const half = Math.ceil(p.length / 2);
  const a = bandBlock(c.rng, kind, p.slice(0, half), p.slice(half), { depth: c.depth[kind] ?? 3, hatchS: hatch === 's', hatchN: hatch === 'n' });
  const b = bandBlock(c.rng, kind, q.slice(0, half), q.slice(half), { depth: c.depth[kind] ?? 3, hatchS: hatch === 's', hatchN: hatch === 'n' });
  return a && b ? [a, b] : null;
}

function spineWings(c: Ctx, f: FactionDef): boolean {
  const front = noseBlock(c.rng, pickNose(new Builder(c.rng), f, c.plan));
  if (!front) return false;
  const secs = sectionsOf(c.rng, c.fam, c.plan);
  const spine = secs.filter((s) => s.kind === 'battery' || s.kind === 'core');
  const wingSpecs = secs.filter((s) => s.kind === 'habitat' || s.kind === 'cargo').flatMap((s) => [...s.top, ...s.bottom]);
  const root = c.A.placeRoot(front);
  // The host section carries hatches for the wings; it sits mid-spine.
  const hostAt = Math.floor(spine.length / 2);
  let prev = root;
  let host = -1;
  const spineIds: number[] = [];
  for (let i = 0; i < spine.length; i++) {
    const sp = spine[i] as SectionPlan;
    const blk = section(c, { ...sp, sponson: i === hostAt ? false : sp.sponson }, i === hostAt ? { hatchN: true, hatchS: true } : {});
    const id = blk ? c.A.attach(prev, blk, { side: 'e' }) : null;
    if (id === null) return no(c, `spine ${sp.kind}`);
    spineIds.push(id);
    c.parts.push(sp.kind);
    if (i === hostAt) host = id;
    prev = id;
  }
  if (host < 0) host = prev;
  let wings: [number, number] | null = null;
  if (wingSpecs.length > 0) {
    const pair = wingPair(c, 'habitat', wingSpecs, 's');
    if (!pair) return no(c, 'wing blocks');
    wings = c.A.attachMirrored(host, host, pair[0], { side: 'n', parentPort: 'hn', childPort: 'hs', align: c.rng.pick(['start', 'mid', 'end'] as const) }, pair[1]);
    if (!wings) return no(c, 'wings');
    c.parts.push('wings');
  }
  const mode = c.rng.pick(c.fam.propulsion);
  if (mode === 'wingPods' && wings) {
    // Distributed drive: an engine pod at the aft end of each wing, the rest on the spine.
    const k = Math.max(1, Math.floor(c.plan.engines / 2));
    if (!c.A.attachMirrored(wings[0], wings[1], endPod(c.rng, k), { side: 'e' })) return no(c, 'wing pods');
    c.plan.engines = Math.max(1, c.plan.engines - 2 * k);
    c.parts.push('wingPods');
    if (!propulsion(c, prev, 'cluster')) return no(c, 'spine cluster');
  } else if (!propulsion(c, prev, mode === 'wingPods' ? 'cluster' : mode)) return no(c, `propulsion ${mode}`);
  return docks(c, [...(wings ? [wings] : []), ...self(spineIds)]) || no(c, 'docks');
}

function twinHull(c: Ctx, f: FactionDef): boolean {
  const secs = sectionsOf(c.rng, c.fam, c.plan);
  const citadel = secs.find((s) => s.centre && s.kind === 'core');
  if (!citadel) return linear(c, f);
  const cit = section(c, citadel, { hatchN: true, hatchS: true });
  if (!cit) return false;
  const root = c.A.placeRoot(cit);
  c.parts.push('citadel');
  const front = noseBlock(c.rng, pickNose(new Builder(c.rng), f, c.plan));
  if (!front || c.A.attach(root, front, { side: 'w' }) === null) return no(c, 'nose');
  // Each hull: guns outboard, crew and stores inboard; north hull mirrored by the south one.
  const rest = secs.filter((s) => s !== citadel);
  const guns = rest.filter((s) => s.kind === 'battery').flatMap((s) => s.top.map((t, i) => [t, s.bottom[i] ?? t] as const));
  const inner = rest.filter((s) => s.kind !== 'battery').flatMap((s) => s.top.map((t, i) => [t, s.bottom[i] ?? t] as const));
  // Hulls run fore to aft in several short sections, so they reach past the citadel's stern.
  const per = Math.max(1, Math.ceil(Math.max(guns.length, inner.length) / 3));
  let prev: [number, number] | null = null;
  const hulls: [number, number][] = [];
  for (let k = 0; k < Math.max(guns.length, inner.length); k += per) {
    const g = guns.slice(k, k + per);
    const n = inner.slice(k, k + per);
    const first: boolean = prev === null;
    const o = first ? { hatchS: true } : {};
    const north = bandBlock(c.rng, 'hull', g.map((x) => x[0]), n.map((x) => x[0]), { depth: c.depth.battery ?? 4, ...o });
    const south = bandBlock(c.rng, 'hull', g.map((x) => x[1]), n.map((x) => x[1]), { depth: c.depth.battery ?? 4, ...o });
    if (!north || !south) return no(c, 'hull blocks');
    const r: [number, number] | null = first
      ? c.A.attachMirrored(root, root, north, { side: 'n', parentPort: 'hn', childPort: 'hs', align: 'start' }, south)
      : c.A.attachMirrored(prev![0], prev![1], north, { side: 'e' }, south);
    if (!r) return no(c, `hull ${first ? 'on citadel' : 'chain'}`);
    hulls.push(r);
    c.parts.push('hull');
    prev = r;
  }
  if (!prev) return false;
  // Twin drives, one per hull.
  const half = { ...c.plan, engines: Math.max(1, Math.ceil(c.plan.engines / 2)), reactors: Math.max(1, Math.ceil(c.plan.reactors / 2)) };
  const mode = c.rng.pick(c.fam.propulsion);
  const blk = mode === 'cluster' ? clusterBlock(c.rng, half.engines, half.reactors) : bankBlock(c.rng, half.engines, half.reactors);
  if (!blk || !c.A.attachMirrored(prev[0], prev[1], blk, { side: 'e' })) return no(c, 'twin drives');
  c.parts.push(`twin ${mode}`);
  return docks(c, [...hulls, [root, root]]) || no(c, 'docks');
}

function carrierIsland(c: Ctx): boolean {
  const secs = sectionsOf(c.rng, c.fam, c.plan);
  const deck = secs.find((s) => s.kind === 'hangar');
  if (!deck) return false;
  const hb = section(c, deck);
  if (!hb) return false;
  const root = c.A.placeRoot(hb);
  c.parts.push('hangar');
  const guns = secs.filter((s) => s.kind === 'battery');
  // Bow battery, an offset command island to one side, a gun sponson block to the other.
  const bow = guns[0] ? section(c, guns[0]) : null;
  if (bow && c.A.attach(root, bow, { side: 'w' }) === null) return no(c, 'bow');
  const island = bandBlock(c.rng, 'command', [c.plan.command], [], { depth: c.plan.command.h, hatchS: true });
  const side = c.rng.chance(0.5) ? 'n' : 's';
  const isl = side === 'n' ? island : island && mirrorBlock(island);
  if (!isl || c.A.attach(root, isl, { side, align: c.rng.pick(['start', 'mid'] as const), doors: 1 }) === null) return no(c, 'island');
  c.parts.push(`island ${side}`);
  const g = guns[1];
  if (g) {
    const blk = section(c, { ...g, sponson: false }, side === 'n' ? { hatchN: true } : { hatchS: true });
    const placed = blk && c.A.attach(root, blk, { side: side === 'n' ? 's' : 'n', align: 'any', doors: 1 });
    if (placed === null || placed === undefined) return no(c, 'gun block');
    c.parts.push('gun block');
  }
  const aft = chain(c, root, order(c.rng, secs.filter((s) => s.kind !== 'hangar' && !guns.slice(0, 2).includes(s))));
  if (aft === null) return no(c, 'aft chain');
  if (!propulsion(c, aft, c.rng.pick(c.fam.propulsion))) return no(c, 'propulsion');
  return docks(c, self(allIds(c)), true) || no(c, 'docks');
}

/** Arrange a navy ship of the family. Returns the builder holding the stamped ship, the arranger and a profile. */
export function arrangeNavy(rng: Rng, f: FactionDef, fam: HullFamilyDef, plan: ShipPlan): { b: Builder; A: Arranger; profile: string } | string {
  const depth: Partial<Record<SectionKind, number>> = {};
  for (const k of Object.keys(fam.depth) as SectionKind[]) {
    const r = fam.depth[k] as readonly [number, number];
    depth[k] = rng.int(r[0], r[1]);
  }
  const A = new Arranger(() => rng.next(), -1);
  const c: Ctx = { rng, fam, plan, A, depth, parts: [], why: '' };
  const ok = fam.grammar === 'spineWings' ? spineWings(c, f) : fam.grammar === 'twinHull' ? twinHull(c, f) : fam.grammar === 'carrierIsland' ? carrierIsland(c) : linear(c, f);
  if (!ok) return c.why || 'no feasible arrangement';
  const b = new Builder(rng, -1);
  A.stamp(b);
  return { b, A, profile: `${fam.grammar}: ${c.parts.join(' ')}` };
}

