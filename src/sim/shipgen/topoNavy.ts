import { doorRows } from './canvas';
import type { Builder, Part, Rect } from './builder';
import { cargoSpec, dockSpec, engineSpec, reactorSpec, type RoomSpec, type ShipPlan } from './plan';
import { pickWeighted } from './plan';
import type { ChunkDef, FactionDef } from './types';

/** Naval topologies: standardised, mirrored, zoned. spine (escort), ring (warship), carrier. */

export const hall = (w: number, h: number): RoomSpec => ({ role: 'hall', mods: [], w, h });

/** Pair rooms for mirrored strips: same role where possible, a crate store otherwise; both get the larger size. */
export function pairUp(specs: RoomSpec[]): [RoomSpec[], RoomSpec[]] {
  const rest = [...specs];
  const n: RoomSpec[] = [];
  const s: RoomSpec[] = [];
  while (rest.length > 0) {
    const a = rest.shift() as RoomSpec;
    const i = rest.findIndex((r) => r.role === a.role);
    const b = i >= 0 ? (rest.splice(i, 1)[0] as RoomSpec) : cargoSpec(2);
    const w = Math.max(a.w, b.w);
    const h = Math.max(a.h, b.h);
    n.push({ ...a, w, h });
    s.push({ ...b, w, h });
  }
  return [n, s];
}

const stripLen = (specs: RoomSpec[]): number => specs.reduce((t, s) => t + s.w + 1, 1);

/** Zoning order for side strips: guns forward, then defences, command support, crew, stores aft. */
const ZONE = ['weapons', 'shields', 'core', 'dock', 'quarters', 'support', 'cargo', 'hangar', 'reactor'];
const zoned = (specs: RoomSpec[]): RoomSpec[] => [...specs].sort((a, b) => ZONE.indexOf(a.role) - ZONE.indexOf(b.role));

/**
 * Engineering at the stern: a transverse corridor at column `x` (its west wall) spanning the joins, engines and
 * reactors stacked on its east side, mirrored about the axis, with a centre item on the axis.
 */
export function stern(b: Builder, x: number, joins: Rect[], engines: number, reactors: number): Part[] {
  const items: RoomSpec[] = [];
  let rLeft = reactors;
  let eLeft = engines;
  let centre: RoomSpec;
  if (eLeft % 2 === 1) { centre = engineSpec(1, 'w'); eLeft--; } else { const k = rLeft % 2 === 1 ? 1 : 2; centre = reactorSpec(Math.min(k, rLeft)); rLeft -= Math.min(k, rLeft); }
  while (eLeft > 0 || rLeft > 0) {
    if (rLeft > 0) { const k = Math.ceil(rLeft / 2); items.push(reactorSpec(k)); rLeft -= Math.min(rLeft, 2 * k); }
    if (eLeft > 0) { items.push(engineSpec(1, 'w')); eLeft -= 2; }
  }
  // Centre item on the axis: pad its height for parity.
  let ch = centre.h + 2;
  if ((b.axis2 + 1 - ch) % 2 !== 0) ch++;
  const centreRect: Rect = { x: x + 2, y: (b.axis2 + 1 - ch) / 2, w: centre.w + 2, h: ch };
  const north: { r: Rect; s: RoomSpec }[] = [];
  let top = centreRect.y;
  // Engines go outermost (they want the open hull), reactors inboard.
  items.sort((p, q) => (p.role === 'engine' ? 1 : 0) - (q.role === 'engine' ? 1 : 0));
  for (const s of items) {
    const h = s.h + 2;
    const r: Rect = { x: x + 2, y: top - h + 1, w: s.w + 2, h };
    north.push({ r, s });
    top = r.y;
  }
  const lo = Math.min(top, ...joins.map((j) => j.y));
  const hi = Math.max(b.axis2 - top, ...joins.map((j) => j.y + j.h - 1));
  const t = b.place({ x, y: lo, w: 3, h: hi - lo + 1 }, 'hall');
  if (!t) return [];
  for (const j of joins) b.door(j, t);
  const out: Part[] = [t];
  const c = b.place(centreRect, centre.role, { ...centre, h: ch - 2 });
  if (c) { b.door(t, c); out.push(c); }
  for (const { r, s } of north) out.push(...b.pair(r, s.role, s, [t, t], true));
  return out;
}

/** Pick a nose chunk; if it has a gun deck, reserve the plan's first weapon room for it. */
function pickNose(b: Builder, f: FactionDef, plan: ShipPlan): { c: ChunkDef; specs: Record<string, RoomSpec> } {
  const c = pickWeighted(b.rng, f.architecture.noses.map((n) => ({ value: n, weight: n.weight ?? 1 })));
  const specs: Record<string, RoomSpec> = { b: plan.command };
  if (c.rows.some((r) => r.includes('w'))) specs.w = plan.weapons.shift() ?? cargoSpec(2);
  return { c, specs };
}

/** Stamp the nose on the west wall at column x with its doors on the axis rows. */
function nose(b: Builder, n: { c: ChunkDef; specs: Record<string, RoomSpec> }, x: number): boolean {
  const doors = doorRows(n.c, 'last');
  const first = (b.axis2 + 1 - doors.length) / 2;
  return Number.isInteger(first) && b.nose(n.c, x, first, n.specs);
}

/** Escort: one spine, mirrored strips, a nose, stern engineering. */
export function spine(b: Builder, f: FactionDef, plan: ShipPlan): string | null {
  const cw = 2;
  b.axis2 = cw + 1;
  const front = pickNose(b, f, plan);
  const side = zoned([...plan.weapons, dockSpec(), dockSpec(), ...plan.shields, ...(plan.core ? [plan.core] : []), ...plan.quarters, ...plan.support, ...plan.cargo, ...plan.hangars]);
  const [n, s] = pairUp(side);
  // Hull profile: a flat run, a wedge deepening aft, or a waist deepest amidships (mirrored, so still symmetric).
  const profile = b.rng.pick(['flat', 'wedge', 'waist'] as const);
  const base = Math.min(5, Math.max(3, ...n.filter((r) => r.role === 'weapons').map((r) => r.h)));
  const depthAt = (i: number): number => {
    const t = n.length > 1 ? i / (n.length - 1) : 0;
    return profile === 'flat' ? base : profile === 'wedge' ? 3 + Math.round(2 * t) : 3 + Math.round(2 * (1 - Math.abs(2 * t - 1)));
  };
  const fit = (r: RoomSpec, i: number): RoomSpec => ({ ...r, h: Math.max(r.role === 'weapons' || r.role === 'hangar' || r.role === 'dock' || r.role === 'shields' ? r.h : 3, depthAt(i)) });
  const n2 = n.map(fit);
  const s2 = s.map((r, i) => ({ ...fit(r, i), h: (n2[i] as RoomSpec).h }));
  n2.forEach((r, i) => { r.h = Math.max(r.h, (s2[i] as RoomSpec).h); (s2[i] as RoomSpec).h = r.h; });
  const L = Math.max(8, stripLen(n));
  const corr = b.place({ x: 0, y: 0, w: L, h: cw + 2 }, 'hall');
  if (!corr || !nose(b, front, 0)) return null;
  b.strip(corr, 'n', n2, 0);
  b.strip(corr, 's', s2, 0);
  if (stern(b, L - 1, [corr], plan.engines, plan.reactors).length === 0) return null;
  return `spine ${profile}, ${n.length}+${s.length} pods`;
}

/** Band rooms between two corridors (doors to both); `cross` hall passages split the band into loops. */
function band(b: Builder, nc: Rect, sc: Rect, specs: RoomSpec[], bh: number, L: number, crosses: number): number {
  let x = nc.x;
  const every = crosses > 0 ? Math.ceil(specs.length / (crosses + 1)) : Infinity;
  let loops = 0;
  specs.forEach((s, i) => {
    const last = i === specs.length - 1;
    const w = last ? Math.max(s.w, nc.x + L - 1 - x - 1) : s.w;
    const p = b.place({ x, y: nc.y + nc.h - 1, w: w + 2, h: bh + 2 }, s.role, { ...s, w, h: bh });
    if (p) { b.door(nc, p); b.door(sc, p); }
    x += w + 1;
    if (!last && (i + 1) % every === 0) {
      const c = b.place({ x, y: nc.y + nc.h - 1, w: 3, h: bh + 2 }, 'hall');
      if (c) { b.door(nc, c); b.door(sc, c); loops++; }
      x += 2;
    }
  });
  return loops;
}

const bandLen = (specs: RoomSpec[], crosses: number): number => specs.reduce((t, s) => t + s.w + 1, 1) + crosses * 2;

/** Warship: two corridors in a loop around a compartment band, mirrored gun strips outboard, nose, stern. */
export function ring(b: Builder, f: FactionDef, plan: ShipPlan, carrier = false): string | null {
  const front = pickNose(b, f, plan);
  const inner = carrier
    ? [...plan.hangars, ...(plan.core ? [plan.core] : []), ...plan.quarters, ...plan.support, ...plan.cargo, ...Array.from({ length: plan.reactors }, () => reactorSpec(1))]
    : [...plan.shields, ...(plan.core ? [plan.core] : []), ...plan.quarters, ...plan.support, ...plan.cargo];
  const outer = [...(carrier ? [...plan.weapons, ...plan.shields] : [...plan.weapons, ...plan.hangars]), dockSpec(), dockSpec()];
  // Balance the band against the outboard strips: crew and stores move outboard until the strips cover the band.
  for (let guard = 0; guard < 12 && !carrier; guard++) {
    const i = inner.findIndex((r) => r.role === 'quarters' || r.role === 'support' || r.role === 'cargo');
    if (i < 0 || bandLen(inner, 0) <= stripLen(pairUp(outer)[0]) + 4) break;
    outer.push(...inner.splice(i, 1));
  }
  let bh = Math.max(3, ...inner.map((s) => s.h));
  if (bh % 2 === 1) bh++;
  const crosses = carrier ? 0 : Math.min(2, Math.floor(plan.size / 2));
  const [n, s] = pairUp(zoned(outer));
  const depth = Math.min(5, Math.max(3, ...n.filter((r) => r.role === 'weapons').map((r) => r.h)));
  const L = Math.max(bandLen(inner, crosses), stripLen(n), 10);
  b.axis2 = bh + 5;
  const nc = b.place({ x: 2, y: 0, w: L, h: 3 }, 'hall');
  const sc = b.place({ x: 2, y: bh + 3, w: L, h: 3 }, 'hall');
  const wc = b.place({ x: 0, y: 0, w: 3, h: bh + 6 }, 'hall');
  if (!nc || !sc || !wc) return null;
  b.door(wc, nc);
  b.door(wc, sc);
  const loops = band(b, nc, sc, inner.length > 0 ? inner : [hall(3, bh)], bh, L, crosses);
  if (!nose(b, front, 0)) return null;
  const fit = (r: RoomSpec): RoomSpec => ({ ...r, h: r.role === 'hangar' || r.role === 'dock' ? Math.max(r.h, depth) : depth });
  b.strip(nc, 'n', n.map(fit), 2);
  b.strip(sc, 's', s.map(fit), 2);
  if (carrier) {
    // Nacelles: engines at the east ends of both corridors, the band ends in a notch between them.
    const kN = Math.ceil(plan.engines / 2);
    const kS = plan.engines - kN;
    const e = engineSpec(kN, 'w');
    const pn = b.place({ x: nc.x + nc.w - 1, y: 1 - 4 * kN, w: 7, h: 4 * kN + 2 }, 'engine', e);
    if (!pn) return null;
    b.door(nc, pn);
    if (kS > 0) {
      const ps = b.place(b.mir({ x: nc.x + nc.w - 1, y: 1 - 4 * kS, w: 7, h: 4 * kS + 2 }), 'engine', engineSpec(kS, 'w'));
      if (ps) b.door(sc, ps);
    }
    return `carrier, ${plan.hangars.length} bays, twin nacelles ${kN}+${kS}`;
  }
  if (stern(b, nc.x + nc.w - 1, [nc, sc], plan.engines, plan.reactors).length === 0) return null;
  return `ring, ${loops + 1} loop${loops > 0 ? 's' : ''}, band ${inner.length}`;
}
