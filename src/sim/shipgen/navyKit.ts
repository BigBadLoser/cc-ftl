import { mirrorBlock, type Arranger, type Block } from './arranger';
import { hallBlock } from './blocks';
import { bandBlock, bankBlock, clusterBlock, deckBlock, enclosedBlock, podBlock, powerBlock, type SectionOpts } from './navyBlocks';
import { cargoSpec, dockSpec, engineSpec, shuffle, type RoomSpec, type ShipPlan } from './plan';
import type { Rng } from '../rng';
import { blockFrom, localBuilder } from './blocks';
import { pairUp } from './topoNavy';
import type { Profile } from './profile';
import { runLen } from './topoParts';
import type { HullFamilyDef, SectionKind } from './types';

/** Shared pieces of the navy grammars: section plans, decks, propulsion configurations, chains. */

export interface SectionPlan {
  kind: SectionKind;
  top: RoomSpec[];
  bottom: RoomSpec[];
  sponson: boolean;
  centre?: RoomSpec[];
  extra?: [RoomSpec[], RoomSpec[]];
}

export interface Ctx {
  rng: Rng;
  fam: HullFamilyDef;
  plan: ShipPlan;
  A: Arranger;
  depth: Partial<Record<SectionKind, number>>;
  parts: string[];
  why: string;
  defs: Record<string, import('../registry').ModuleDef>;
  /** Drawn once per ship (like the grammar): architecture choices every candidate arrangement shares. */
  variant?: number;
}

export const no = (c: Ctx, why: string): false => { c.why ||= why; return false; };

/** The ship's rooms by job: guns (weapon room pairs), core (AI, shields), crew (quarters, support, docks), stores. */
export function jobs(plan: ShipPlan): { guns: RoomSpec[]; core: RoomSpec[]; crew: RoomSpec[]; stores: RoomSpec[] } {
  return {
    guns: [...plan.weapons],
    core: [...(plan.core ? [plan.core] : []), ...plan.shields],
    crew: [...plan.quarters, ...plan.support, dockSpec(), dockSpec()],
    stores: [...plan.cargo],
  };
}

/** Group room specs into mirrored band sections of at most `per` rooms per side. */
export function bands(kind: SectionKind, specs: RoomSpec[], per: number, sponson = false): SectionPlan[] {
  const [n, s] = pairUp(specs);
  const parts = Math.ceil(n.length / Math.max(1, per));
  const out: SectionPlan[] = [];
  for (let k = 0; k < parts; k++) {
    const a = Math.floor((k * n.length) / parts);
    const z = Math.floor(((k + 1) * n.length) / parts);
    out.push({ kind, top: n.slice(a, z), bottom: s.slice(a, z), sponson });
  }
  return out;
}

/** Build a section block, raising its kind's depth until its rooms fit. */
export function section(c: Ctx, sp: SectionPlan, o: Omit<SectionOpts, 'depth'> = {}): Block | null {
  for (let t = 0; t < 4; t++) {
    const depth = c.depth[sp.kind] ?? 3;
    const blk = sp.centre ? enclosedBlock(c.rng, sp.kind, sp.centre, sp.extra ?? [[], []], { ...o, depth }) : bandBlock(c.rng, sp.kind, sp.top, sp.bottom, { ...o, depth, sponson: sp.sponson });
    if (blk) return blk;
    c.depth[sp.kind] = depth + 1;
  }
  return null;
}

/** Chain sections fore to aft from block `from`; returns the block ids. */
export function chain(c: Ctx, from: number, secs: SectionPlan[], hatchAt = -1): number[] | null {
  let prev = from;
  const ids: number[] = [];
  for (let i = 0; i < secs.length; i++) {
    const sp = secs[i] as SectionPlan;
    const blk = section(c, i === hatchAt ? { ...sp, sponson: false } : sp, i === hatchAt ? { hatchN: true, hatchS: true } : {});
    const id = blk ? c.A.attach(prev, blk, { side: 'e' }) : null;
    if (id === null) { no(c, `chain ${sp.kind}`); return null; }
    c.parts.push(sp.kind);
    ids.push(id);
    prev = id;
  }
  return ids;
}

/** Constraint-scored fore-to-aft order with seeded slack. */
export function order(rng: Rng, mid: SectionPlan[]): SectionPlan[] {
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

/**
 * A mirrored pair of outboard decks from one list of rooms (each deck its own half, same outline), laid lengthways
 * along a host's north / south face. Tries the host's hatch, passage and room ports in turn.
 */
export function deckPair(
  c: Ctx, host: number, mhost: number, kind: string, specs: RoomSpec[], align: 'start' | 'mid' | 'end' = 'mid', o: { span?: number; xMin?: number; profile?: Profile } = {},
): [number, number] | null {
  if (specs.length === 0) return null;
  const [p0, q0] = pairUp(specs);
  const depth = c.depth.habitat ?? 3;
  // A profiled pair shares one outline: rooms matched in width, a store filling the shorter side.
  const [p, q] = o.profile ? matched(p0, q0) : [p0, q0];
  const len = Math.max(o.span ?? 0, runLen(p), runLen(q));
  const n = deckBlock(c.rng, kind, p, depth, len, o.profile);
  const s = deckBlock(c.rng, kind, q, depth, len, o.profile);
  if (!n || !s) return null;
  const ports = c.A.free(host, 'n').map((x) => x.id).sort((a, b) => rankPort(a) - rankPort(b));
  for (const pp of ports) {
    const r = c.A.attachMirrored(host, mhost, n, { side: 'n', parentPort: pp, childPort: 'xs', align, ...(o.xMin !== undefined ? { xMin: o.xMin } : {}) }, s);
    if (r) { c.parts.push(`${kind} decks`); return r; }
  }
  return null;
}

/** Wall-to-wall length of a run of placed blocks fore to aft, and its west wall (to lay a deck the whole way along). */
export function spanOf(c: Ctx, ids: number[]): { span: number; xMin: number } {
  const a = c.A.bounds(ids[0] as number);
  const z = c.A.bounds(ids[ids.length - 1] as number);
  return { span: z.x + z.w - 1 - (a.x + 1), xMin: a.x + 1 };
}

/** One interior depth for every section kind of a spine, so decks laid along it sit flush on all of them. */
export function evenDepth(c: Ctx, kinds: SectionKind[], deeper = 0): void {
  // `deeper`: at least this much deeper than the decks (the hull steps down to them).
  const d = Math.max((c.depth.habitat ?? 3) + deeper, ...kinds.map((k) => c.depth[k] ?? 3));
  for (const k of kinds) c.depth[k] = d;
}

function matched(p: RoomSpec[], q: RoomSpec[]): [RoomSpec[], RoomSpec[]] {
  const k = Math.max(p.length, q.length);
  const a: RoomSpec[] = [];
  const b: RoomSpec[] = [];
  for (let i = 0; i < k; i++) {
    const x = p[i] ?? cargoSpec(1);
    const y = q[i] ?? cargoSpec(1);
    const w = Math.max(x.w, y.w);
    const h = Math.max(x.h, y.h);
    a.push({ ...x, w, h });
    b.push({ ...y, w, h });
  }
  return [a, b];
}

const rankPort = (id: string): number => (id.startsWith('h') ? 0 : id.startsWith('p') ? 1 : 2);

/** Engine room entered from the west, on the axis rows (a pod at the end of a deck or hull). */
export function endPod(rng: Rng, k: number): Block {
  const b = localBuilder(rng);
  const e = engineSpec(k, 'w');
  b.place({ x: 0, y: -1 - 2 * k, w: e.w + 2, h: e.h + 2 }, 'engine', e);
  return blockFrom(b, 'drive', `pod ${k}E`, 'human', [{ id: 'w', side: 'w', x: 0, y: -1, len: 2, access: 'human' }]);
}

/** A propulsion configuration aft of block `aft` (on the axis). Engines always face +x. */
export function propulsion(c: Ctx, aft: number, mode: HullFamilyDef['propulsion'][number]): boolean {
  const { rng, plan, A } = c;
  const E = plan.engines;
  c.parts.push(mode);
  if (mode === 'bank') { const b = bankBlock(rng, E, plan.reactors); return (!!b && A.attach(aft, b, { side: 'e' }) !== null) || no(c, 'bank'); }
  if (mode === 'cluster' || mode === 'wingPods') { const b = clusterBlock(rng, E, plan.reactors); return (!!b && A.attach(aft, b, { side: 'e' }) !== null) || no(c, 'cluster'); }
  const pw = powerBlock(rng, plan.reactors);
  const p = pw ? A.attach(aft, pw, { side: 'e' }) : null;
  if (p === null) return no(c, 'power');
  const k = Math.ceil(E / 2);
  if (mode === 'nacelles') {
    const arm = A.attachMirrored(p, p, hallBlock(rng, rng.int(1, 3), 2, false), { side: 'n', parentPort: 'hn' });
    return (!!arm && !!A.attachMirrored(arm[0], arm[1], podBlock(rng, k), { side: 'n', doors: 1 })) || no(c, 'nacelles');
  }
  for (const port of A.free(p, 'n')) {
    if (A.attachMirrored(p, p, podBlock(rng, k), { side: 'n', parentPort: port.id, align: 'end', doors: 1 })) return true;
  }
  return no(c, 'side drives');
}

/** Twin drives at the east ends of two mirrored hulls ('start': pushed outboard, leaving the gap between open aft). */
export function twinDrives(c: Ctx, hulls: [number, number], mode: HullFamilyDef['propulsion'][number], align: 'start' | 'mid' = 'mid'): boolean {
  const e = Math.max(1, Math.ceil(c.plan.engines / 2));
  const r = Math.max(1, Math.ceil(c.plan.reactors / 2));
  const blk = mode === 'cluster' ? clusterBlock(c.rng, e, r) : bankBlock(c.rng, e, r);
  c.parts.push(`twin ${mode}`);
  return (!!blk && !!c.A.attachMirrored(hulls[0], hulls[1], blk, { side: 'e', align })) || no(c, 'twin drives');
}

export { mirrorBlock };
