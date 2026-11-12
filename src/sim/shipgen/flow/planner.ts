import type { RoomSpec } from '../plan';
import type { Rng } from '../../rng';
import { K, site, stripsFor, type Site } from '../stationFlowKit';
import { buildArm, type ArmPlan } from './arms';
import { placeBand, type BandAsk } from './band';
import { departmentsOf, frontage } from './departments';
import { innerRoom, placeInner } from './inner';
import { DIRS, type Dept, type Dir, type StationFlowDef } from './types';

/**
 * The flow planner: a station's structure from its department flow and its program (docs/STATION_FLOW_WHEEL.md).
 *
 * Every way of giving the arm departments a direction and a section (inside the ring, or out on a wing) is enumerated
 * and filtered by the flow's hard rules; each surviving structure is sized by its contents, built on a lattice ring
 * (the smallest radius that takes it), and scored: the flow's preferences, the proportion rules, size. Structures are
 * grouped by their skeleton (which arms run out, where the gated arm is, which streets exist); the seed picks among the
 * good ones, so one flow gives several skeletons. No direction, radius or coordinate is written anywhere but here and
 * in arms.ts, and none of it names a station.
 */

const ANGLE: Record<Dir, number> = { n: 0, e: Math.PI / 2, s: Math.PI, w: (3 * Math.PI) / 2 };
/** Quarter turns between two directions: 0 the same, 1 neighbours, 2 opposite. */
const turns = (a: Dir, b: Dir): number => { const d = Math.abs(DIRS.indexOf(a) - DIRS.indexOf(b)); return Math.min(d, 4 - d); };
const COURT = { none: 2, small: 4, large: 7 } as const;
/** Radii tried, in lattice cells. */
const CELLS = [7, 8, 9, 10, 11, 12, 13] as const;
/** Structures built (the best by the cheap score), and how many of the best skeletons the seed chooses among. */
const BUILD = 36;
const CHOICE = 4;

interface Slot { dept: Dept; dir: Dir; section: 'inner' | 'outer' }

export interface FlowPlan {
  site: Site;
  flow: StationFlowDef;
  /** The skeleton in words: wings, the gated arm, the streets. */
  skeleton: string;
  score: number;
  R: number;
  spare: number;
  /** Tiles of street inside the ring with no room on either side. */
  bare: number;
  /** Rooms the flow gives no department (they are left out: a gap in the flow, reported). */
  loose: RoomSpec[];
  /** Filler rooms placed (shops), and band rooms standing on streets instead. */
  shops: number;
  spilled: number;
  /** Why each smaller radius failed for this structure (what set its size). */
  smaller: string[];
  /** The other skeletons found, best first, and why structures were rejected. */
  others: string[];
  rejected: string[];
}

/** Every assignment of the arm departments to a direction and a section that the flow's hard rules allow. */
function assignments(depts: readonly Dept[]): Slot[][] {
  const arm = depts.filter((d) => !d.def.place.includes('band') && (d.def.place.includes('arm') || d.def.place.includes('wing')) && d.rooms.length + d.docks.length > 0);
  // Departments that follow another onto its arm are placed after it.
  arm.sort((a, c) => Number(!!a.def.with) - Number(!!c.def.with));
  const out: Slot[][] = [];
  const walk = (i: number, got: Slot[]): void => {
    if (i === arm.length) { out.push(got); return; }
    const d = arm[i] as Dept;
    const options: [Dir, Slot['section']][] = [];
    if (d.def.with) {
      const host = got.find((q) => q.dept.def.id === d.def.with && q.section === 'outer');
      if (host) options.push([host.dir, 'inner']);
    } else {
      for (const dir of DIRS) {
        if (d.def.place.includes('arm') && d.docks.length === 0) options.push([dir, 'inner']);
        if (d.def.place.includes('wing')) options.push([dir, 'outer']);
      }
    }
    for (const [dir, section] of options) {
      const here = got.filter((q) => q.dir === dir);
      if (here.some((q) => q.section === section)) continue;
      // A controlled department has its arm to itself.
      if (here.some((q) => q.dept.def.access === 'controlled') || (d.def.access === 'controlled' && here.length > 0)) continue;
      walk(i + 1, [...got, { dept: d, dir, section }]);
    }
  };
  walk(0, []);
  return out;
}

/** The flow's preferences between the placed departments, and its landmark: the cheap score of an assignment. */
function liking(flow: StationFlowDef, slots: readonly Slot[]): number {
  const at = new Map(slots.map((q) => [q.dept.def.id, q]));
  let v = 0;
  for (const p of flow.prefs) {
    const a = at.get(p.a), b = at.get(p.b);
    if (!a || !b) continue;
    const t = turns(a.dir, b.dir);
    v += (p.weight ?? 1) * (p.kind === 'near' ? 2 - t : t);
  }
  const mark = flow.intent.landmark ? at.get(flow.intent.landmark) : undefined;
  if (mark?.section === 'outer') v += 3; // the landmark breaks the hull
  return v;
}

/** The arms of an assignment: its streets, what lines them, how far each runs. */
function armsOf(flow: StationFlowDef, depts: readonly Dept[], slots: readonly Slot[], cells: number): ArmPlan[] {
  const arms = new Map<Dir, ArmPlan>();
  const arm = (dir: Dir): ArmPlan => arms.get(dir) ?? arms.set(dir, { dir, width: 2, inner: [], fill: [], gated: false, reach: 'ring', outer: [], docks: [], customs: false }).get(dir) as ArmPlan;
  const bySize = (a: RoomSpec, c: RoomSpec): number => c.w * c.h - a.w * a.h;
  for (const q of slots) {
    const a = arm(q.dir);
    if (q.section === 'outer') {
      Object.assign(a, { outer: [...q.dept.rooms].sort(bySize), docks: q.dept.docks, reach: 'out', width: 3, customs: !!q.dept.def.customs || q.dept.def.access === 'controlled', dept: q.dept.def.id });
    } else {
      (q.dept.def.fill ? a.fill : a.inner).push(...[...q.dept.rooms].sort(bySize));
      if (q.dept.def.access === 'controlled') Object.assign(a, { gated: true, reach: 'short', dept: q.dept.def.id });
    }
  }
  const open = (): ArmPlan[] => [...arms.values()].filter((a) => !a.gated);
  // The ring joins the centre by two public streets at least (a loop, and nobody walks the long way round): streets
  // are added opposite what is there.
  while (open().length < 2) {
    const free = DIRS.filter((d) => !arms.has(d));
    if (free.length === 0) break;
    const far = (d: Dir): number => open().reduce((t, a) => t + turns(d, a.dir), 0);
    arm(free.sort((a, c) => far(c) - far(a))[0] as Dir);
  }
  // Court departments stand where the public streets leave the court, shared between them: their rooms first, then
  // their filler (a market's shops).
  const streets = open();
  let turn = 0;
  for (const d of depts.filter((q) => q.def.place.includes('court'))) {
    for (const r of [...d.rooms].sort(bySize)) {
      const a = streets[turn++ % streets.length] as ArmPlan;
      if (d.def.fill) a.fill.push(r); else a.inner.unshift(r);
    }
  }
  // A street runs to the ring when it is one of the first two public ones, or when rooms line most of the way;
  // otherwise it stops with its rooms (no long bare corridor).
  const inside = cells * K - 13 - COURT[flow.intent.court];
  let joined = open().filter((a) => a.reach === 'out').length;
  for (const a of open().filter((q) => q.reach !== 'out').sort((p, q) => q.inner.length - p.inner.length)) {
    const need = frontage([...a.inner, ...a.fill]) / 2;
    if (joined < 2 || need >= 0.55 * inside) { a.reach = 'ring'; joined++; } else a.reach = 'short';
  }
  // Wings first (they claim the band's depth), then the gated street, then the rest; among equals the street with
  // the biggest room first, so the big rooms get the corners by the court and the small ones fit round them.
  const rank = (a: ArmPlan): number => (a.reach === 'out' ? 0 : a.gated ? 1 : 2);
  const biggest = (a: ArmPlan): number => Math.max(0, ...a.inner.map((r) => r.w * r.h));
  return [...arms.values()].sort((a, c) => rank(a) - rank(c) || biggest(c) - biggest(a));
}

/** Where each band department wants to stand: the direction (of eight) its preferences like best. */
function bandAsks(flow: StationFlowDef, depts: readonly Dept[], slots: readonly Slot[]): BandAsk[] {
  const at = new Map(slots.map((q) => [q.dept.def.id, ANGLE[q.dir]]));
  const apart = (a: number, b: number): number => { const d = Math.abs(a - b) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
  const asks: BandAsk[] = [];
  for (const d of depts) {
    if (!d.def.place.includes('band') || d.rooms.length === 0) continue;
    let best = 0, bestV = -Infinity;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      let v = 0;
      for (const p of flow.prefs) {
        const other = p.a === d.def.id ? p.b : p.b === d.def.id ? p.a : null;
        const oa = other === null ? undefined : at.get(other);
        if (oa === undefined) continue;
        v += (p.weight ?? 1) * (p.kind === 'near' ? -apart(a, oa) : apart(a, oa));
      }
      // Clear of the wings' feet when nothing else decides.
      v += 0.05 * Math.min(...slots.filter((q) => q.section === 'outer').map((q) => apart(a, ANGLE[q.dir])), Math.PI);
      if (v > bestV) { bestV = v; best = a; }
    }
    at.set(d.def.id, best);
    for (const spec of d.rooms) asks.push({ spec, angle: best });
  }
  return asks;
}

interface Built { site: Site; R: number; bare: number; out: number; spare: number; shops: number; spilled: number; smaller: string[] }

/**
 * One try at one radius. `spill` names band rooms (department index:room index) to stand on the streets instead; when
 * the band comes up short of rooms that may, they are returned to be spilled on the next try.
 */
function attempt(flow: StationFlowDef, source: readonly Dept[], placed: readonly Slot[], cells: number, spill: ReadonlySet<string>): Built | { why: string; spill?: Set<string> } {
  // Fresh room specs for every build: placing may change one (a cabin given a second bed).
  const copy = (r: RoomSpec): RoomSpec => ({ ...r, mods: [...r.mods] });
  const depts = source.map((d) => ({ ...d, rooms: d.rooms.map(copy), docks: d.docks.map(copy) }));
  const keyOf = new Map<RoomSpec, string>();
  depts.forEach((d, i) => d.rooms.forEach((r, j) => keyOf.set(r, `${i}:${j}`)));
  const extra: RoomSpec[] = [];
  for (const d of depts) {
    if (!d.def.place.includes('band')) continue;
    extra.push(...d.rooms.filter((r) => spill.has(keyOf.get(r) as string)));
    d.rooms = d.rooms.filter((r) => !spill.has(keyOf.get(r) as string));
  }
  const slots = placed.map((q) => ({ ...q, dept: depts[source.indexOf(q.dept)] as Dept }));
  const R = cells * K;
  const s = site(R, 40);
  // The court keeps its intended size where the ring allows, and never takes more than a third of the way out.
  const c = Math.min(COURT[flow.intent.court], Math.max(2, Math.floor(s.reach * 0.3)));
  const court = s.g.hall(flow.intent.court === 'none' ? 'hall' : 'plaza', 'commons');
  s.g.street(court, -c, -c, c, c);
  const arms = armsOf(flow, depts, slots, cells);
  // Spilled rooms line the public streets after what is there: plain streets before a wing's, the emptiest first, each
  // taking what its frontage should hold.
  const hosts = arms.filter((a) => !a.gated).sort((a, b) => Number(a.reach === 'out') - Number(b.reach === 'out') || frontage(a.inner) - frontage(b.inner));
  let pending = extra;
  for (const a of hosts) {
    if (pending.length === 0) break;
    let room = 2 * (s.reach - 2 - c) - frontage(a.inner) - 4;
    const take = pending.filter((r) => (room -= r.w + 1) >= 0);
    if (take.length === 0) continue;
    a.inner.push(...take);
    if (a.reach === 'short') a.reach = 'ring';
    pending = pending.filter((r) => !take.includes(r));
  }
  if (pending.length > 0) return { why: `R ${R}: streets short of frontage for ${pending.length} spilled rooms` };
  let bare = 0, out = 0, shops = 0;
  for (const arm of arms) {
    const r = buildArm(s, c, arm);
    if (!r.ok) return { why: `R ${R}: ${r.why}` };
    bare += r.bare;
    shops += r.filled;
    out = Math.max(out, r.out);
  }
  const asks = bandAsks(flow, depts, slots);
  const band = placeBand(s, asks);
  // What the band cannot hold stands on the ring's inner side, when it is small enough to.
  if (band.left.length > 0) {
    const inner = band.left.filter(innerRoom);
    const rest = placeInner(s, asks.filter((a) => inner.includes(a.spec)));
    band.left = band.left.filter((r) => !inner.includes(r) || rest.includes(r));
  }
  if (band.left.length > 0) {
    const may = band.left.every((r) => depts.some((d) => d.def.place.includes('arm') && d.rooms.includes(r)));
    const why = `R ${R}: band short of ${band.left.length} rooms (${band.left.filter((r) => !r.cabin).map((r) => `${r.role} ${stripsFor(r)}`).join(', ')})`;
    return may ? { why, spill: new Set([...spill, ...band.left.map((r) => keyOf.get(r) as string)]) } : { why };
  }
  const cut = s.g.stranded();
  if (cut.length > 0) return { why: `R ${R}: no way in to ${cut.map(([x, y, id]) => `${s.g.regions[id]?.role} at ${x},${y}`).join('; ')}` };
  return { site: s, R, bare, out, spare: band.spare, shops, spilled: extra.length, smaller: [] };
}

/** Build an assignment on the smallest ring that takes it, or say why none does. */
function build(flow: StationFlowDef, source: readonly Dept[], placed: readonly Slot[]): Built | string {
  let why = '';
  const smaller: string[] = [];
  for (const cells of CELLS) {
    let r = attempt(flow, source, placed, cells, new Set());
    // The band short of rooms that may line a street: once more with those on the streets.
    if (!('site' in r) && r.spill) { smaller.push(`${r.why}, spilled`); r = attempt(flow, source, placed, cells, r.spill); }
    if ('site' in r) return { ...r, smaller };
    why = r.why;
    smaller.push(why);
  }
  return why;
}

/**
 * The skeleton of an assignment in a few words, the same for every turn and mirror image of it: what runs out as a
 * wing, what is gated, how many plain streets, and how the pieces stand to each other (beside or opposite).
 */
function skeletonOf(flow: StationFlowDef, depts: readonly Dept[], slots: readonly Slot[]): string {
  const arms = armsOf(flow, depts, slots, 10);
  const named = arms.filter((a) => a.dept).map((a) => ({ name: `${a.dept} ${a.reach === 'out' ? 'wing' : a.gated ? 'gated' : 'street'}`, dir: a.dir })).sort((p, q) => p.name.localeCompare(q.name));
  const rel: string[] = [];
  for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) {
    const p = named[i] as { name: string; dir: Dir }, q = named[j] as { name: string; dir: Dir };
    rel.push(`${p.name.split(' ')[0]}-${q.name.split(' ')[0]} ${['same', 'beside', 'opposite'][turns(p.dir, q.dir)]}`);
  }
  const inner = slots.filter((q) => q.section === 'inner' && q.dept.def.access !== 'controlled').map((q) => `${q.dept.def.id} inside`);
  const plain = arms.filter((a) => !a.dept).length;
  return [...named.map((p) => p.name), ...inner, plain > 0 ? `${plain} plain street${plain > 1 ? 's' : ''}` : '', `(${rel.join(', ')})`].filter(Boolean).join(', ');
}

/**
 * Plan a station for these rooms. `pick` chooses among the best skeletons (0 = the best); without it the seed chooses.
 * Returns null when no structure of the flow can be built, with the reasons in `trace`.
 */
export function planFlow(rng: Rng, flow: StationFlowDef, rooms: readonly RoomSpec[], o: { pick?: number; trace?: string[] } = {}): FlowPlan | null {
  const { depts, loose } = departmentsOf(flow, rooms);
  const all = assignments(depts).map((slots) => ({ slots, like: liking(flow, slots) })).sort((a, c) => c.like - a.like);
  const best = new Map<string, FlowPlan>();
  const rejected: string[] = [];
  for (const { slots, like } of all.slice(0, BUILD)) {
    const skeleton = skeletonOf(flow, depts, slots);
    const b = build(flow, depts, slots);
    if (typeof b === 'string') { rejected.push(`${skeleton}: ${b}`); continue; }
    // Proportions: the ring no bigger than its contents, streets lined not bare, band not left spare, and a wing that
    // stands out far enough to read.
    const wings = slots.filter((q) => q.section === 'outer').length;
    const score = like - 0.5 * (b.R / K) - 0.06 * b.bare - 0.15 * b.spare + 0.15 * b.shops + (wings > 0 && b.out >= 2 * K ? 1 : 0) - (wings > 2 ? 1 : 0);
    // Turned and mirrored copies of one skeleton score alike: the seed keeps one of them.
    const prev = best.get(skeleton);
    if (!prev || score > prev.score + 0.01 || (Math.abs(score - prev.score) <= 0.01 && rng.chance(0.5))) best.set(skeleton, { site: b.site, flow, skeleton, score, R: b.R, spare: b.spare, bare: b.bare, shops: b.shops, spilled: b.spilled, loose, smaller: b.smaller, others: [], rejected });
  }
  const ranked = [...best.values()].sort((a, c) => c.score - a.score);
  o.trace?.push(...rejected);
  if (ranked.length === 0) return null;
  // The seed chooses among the best few skeletons that are close to the best.
  const close = ranked.filter((p) => p.score >= (ranked[0] as FlowPlan).score - 3).slice(0, CHOICE);
  const chosen = close[o.pick !== undefined ? Math.min(o.pick, close.length - 1) : rng.int(0, close.length - 1)] as FlowPlan;
  chosen.others = ranked.filter((p) => p !== chosen).map((p) => `${p.skeleton} (${p.score.toFixed(1)}, R ${p.R})`);
  return chosen;
}
