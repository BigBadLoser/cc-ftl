import type { Rng } from '../../rng';
import { K, rectSpots, type Grid } from './grid';
import { machinesFit, rowFits } from './machine';
import { cutRegion, type Cut } from './parcels';
import { planCabins } from './rows';
import type { Dept, DeptId } from './program';
import { rasterise, type Region, type Structure } from './structure';
import { dirAngle, type Template } from './template';

/**
 * Departments onto the structure (docs/STATIONGEN2.md section 3.3, "Assignment"), and the structure's depths solved
 * from them. A draw puts each department in a zone (the outer band, the middle band, the inner zone) and, where spokes
 * cut the zone, a sector; harbours are anchored at their faces in the outer band with freight beside the first. Each
 * zone is then made just deep enough for the floor its busiest sector needs (and its departments' minimum depth), which
 * gives the ring radii and the hull radius: rooms are not stretched to fill a ring drawn first. The raster's regions
 * are cut into parcels along the angle, and the draw is scored on the parcel map: floor against need, depth, every
 * rectangular facility fitting its parcel (a draw where one does not is rejected), habitation apart from the harbour and
 * engineering, the market by a court, little court area, compactness.
 */

export interface Parcel { dept: DeptId; part: number; tiles: number[] }

export interface Assignment {
  s: Structure;
  parcels: Parcel[];
  /** Regions left as courts. */
  courts: number[][];
  score: number;
  /** Why a draw was rejected (hard failures), empty if feasible. */
  why: string;
}

/** Thickness of a tile set: twice the greatest 4-step distance from a tile to the set's edge, less one. */
export function thickness(g: Grid, tiles: readonly number[]): number {
  const mine = new Set(tiles);
  const seen = new Set<number>();
  let q: number[] = [];
  for (const i of tiles) if (g.nb(i).some((j) => !mine.has(j))) { seen.add(i); q.push(i); }
  let d = 1;
  for (;;) {
    const next: number[] = [];
    for (const i of q) for (const j of g.nb(i)) if (mine.has(j) && !seen.has(j)) { seen.add(j); next.push(j); }
    if (next.length === 0) break;
    d++;
    q = next;
  }
  return 2 * d - 1;
}

/** Does a rectangle of interior w x h (with its walls) fit in the tiles, either way round? */
export const fitsRect = (g: Grid, tiles: ReadonlySet<number>, w: number, h: number): boolean =>
  rectSpots(g, tiles, w + 2, h + 2).length > 0 || rectSpots(g, tiles, h + 2, w + 2).length > 0;

/** Zones from the outside in: 0 the outer band, 1 the band inside ring 0, 2 the inner zone of a two-ring station. */
interface Item { key: string; dept: Dept; weight: number; zone: number; sector: number; anchor?: { a: number; span: number }; gap?: number }

const TAU = 2 * Math.PI;
/** Share of a zone's floor that walls between parcels and spokes leave. */
const NET = 0.86;

/** The spoke angles that cut zone `z` (none for the outer band). */
function cuts(t: Template, z: number): number[] {
  if (z === 0 || t.kind === 'concourse') return [];
  const from = t.kind === 'concentric' && z === 1 ? 1 : -1;
  return [...new Set(t.spokes.filter((s) => s.from <= from || s.from === -1).map((s) => dirAngle(s.dir)))].sort((a, b) => a - b);
}

/** Sector spans of a zone: [a0, span] between consecutive spokes (one full sector without). */
function sectors(t: Template, z: number): [number, number][] {
  const c = cuts(t, z);
  if (c.length === 0) return [[0, TAU]];
  return c.map((a, k) => [a, (((c[(k + 1) % c.length] as number) - a + TAU) % TAU) || TAU]);
}

/** Depth for `area` over a sector of `span` starting at radius `a`. */
const depthFor = (a: number, span: number, area: number): number => Math.sqrt(a * a + (2 * area) / (span * NET)) - a;

/** The zones a family has, outside in. */
const zonesOf = (t: Template): number[] => (t.kind === 'concentric' ? [0, 1, 2] : [0, 1]);

/** Solve band depths and the hull radius for the items (the template is updated in place); also the floor to spare. */
function solve(t: Template, items: readonly Item[]): { R: number; waste: number } {
  let waste = 0;
  // An empty inner zone closes up: the inner ring runs straight round the rotunda (a promenade round the court).
  const minD = (z: number): number => (z === 2 && !items.some((i) => i.zone === 2) ? 0 : Math.max(6, ...items.filter((i) => i.zone === z).map((i) => i.dept.minDepth)));
  const need = (z: number, s: number): number => items.filter((i) => i.zone === z && i.sector === s).reduce((a, i) => a + i.weight, 0);
  const zoneDepth = (z: number, a: number): number => {
    const sec = sectors(t, z);
    let d = minD(z);
    sec.forEach(([, span], s) => { d = Math.max(d, Math.ceil(depthFor(a, span, need(z, s)))); });
    if (z !== 0) sec.forEach(([, span], s) => { waste += 0.5 * span * ((a + d) ** 2 - a * a) * NET - need(z, s); });
    return d;
  };
  let a: number;
  const bands: number[] = [];
  if (t.kind === 'concentric') {
    const dIn = zoneDepth(2, t.rc + 0.5);
    a = t.rc + 0.5 + dIn + (t.rings[1]?.w ?? 2);
    const dMid = zoneDepth(1, a);
    a += dMid + (t.rings[0]?.w ?? 2);
    bands.push(0, dMid);
  } else if (t.kind === 'wheel') {
    a = t.rc + 0.5 + (t.hollow ?? 8);
    const dMid = zoneDepth(1, a);
    a += dMid + (t.rings[0]?.w ?? 2);
    bands.push(0, dMid);
  } else {
    // Concourse: the inner disc holds its departments and the streets across it.
    const inner = items.filter((i) => i.zone === 1).reduce((s, i) => s + i.weight, 0);
    const r = Math.max(10, Math.sqrt(inner / (Math.PI * 0.8)));
    waste += Math.PI * r * r * 0.8 - inner;
    a = r + (t.rings[0]?.w ?? 2);
    bands.push(0);
  }
  // The outer band keeps the template's depth (deeper only for a department that needs it): the inner zones grow to
  // hold the rest, and floor the band cannot hold counts against the draw.
  const dOut = Math.max(t.outer, minD(0));
  const capOut = Math.PI * ((a + dOut) ** 2 - a * a) * NET;
  const needOut = need(0, 0);
  waste += Math.max(0, capOut - needOut) + 6 * Math.max(0, needOut - capOut);
  bands[0] = dOut;
  t.bands = bands;
  return { R: Math.ceil(a + dOut - 0.5), waste };
}

/**
 * A draw of zones and sectors for every department part: parts in a random order, each put where the station stays
 * smallest with the least floor to spare (with some noise, and the market drawn to the rotunda), so sectors fill evenly.
 */
function draw(rng: Rng, t: Template, depts: readonly Dept[]): Item[] {
  const zones = zonesOf(t);
  const items: Item[] = [];
  const harbours = depts.filter((d) => d.docks);
  harbours.forEach((h, k) => {
    const dir = t.harbours[k]?.dir ?? 6;
    items.push({ key: `${h.id}#0`, dept: h, weight: h.need, zone: 0, sector: 0, anchor: { a: dirAngle(dir), span: 0 } });
  });
  const gaps = Math.max(1, harbours.length);
  const fr = depts.find((d) => d.id === 'freight');
  if (fr) items.push({ key: 'freight#0', dept: fr, weight: fr.need, zone: 0, sector: 0, gap: rng.chance(0.5) ? 0 : gaps - 1 });
  const parts: Item[] = [];
  for (const d of depts) {
    if (d.docks || d.id === 'freight') continue;
    const n = d.id === 'engineering' || d.id === 'defence' ? 1 : rng.int(1, d.id === 'habitation' ? 4 : 3);
    for (let p = 0; p < n; p++) parts.push({ key: `${d.id}#${p}`, dept: d, weight: d.need / n, zone: 0, sector: 0 });
  }
  const cost = (its: readonly Item[]): number => {
    const { R, waste } = solve(t, its);
    const pref = its.filter((i) => i.dept.id === 'market' && t.kind === 'concentric' && i.zone >= 1).length * -20;
    return 3 * R + Math.max(0, waste) / 4 + pref;
  };
  const slots = zones.flatMap((z) => sectors(t, z).map((_, s) => ({ z, s })));
  // Greedy, parts in a random order, each where the station stays smallest with the least floor to spare (with noise).
  for (const it of parts.map((p) => ({ p, k: rng.next() })).sort((a, b) => a.k - b.k).map((x) => x.p)) {
    let best = slots[0] as { z: number; s: number }, top = Infinity;
    for (const sl of slots) {
      const v = cost([...items, { ...it, zone: sl.z, sector: sl.s }]) + rng.next() * 12;
      if (v < top) { top = v; best = sl; }
    }
    items.push({ ...it, zone: best.z, sector: best.s, ...(best.z === 0 ? { gap: rng.int(0, gaps - 1) } : {}) });
  }
  // Then local search: move one part at a time while the cost falls.
  let now = cost(items);
  const movable = items.filter((i) => !i.anchor && i.key !== 'freight#0');
  for (let k = 0; k < 120 && movable.length > 0; k++) {
    const it = movable[rng.int(0, movable.length - 1)] as Item;
    const sl = slots[rng.int(0, slots.length - 1)] as { z: number; s: number };
    const was = { zone: it.zone, sector: it.sector, gap: it.gap };
    it.zone = sl.z; it.sector = sl.s; it.gap = sl.z === 0 ? rng.int(0, gaps - 1) : undefined;
    const v = cost(items);
    if (v <= now) now = v; else Object.assign(it, was);
  }
  // Freight stays at its end of the first harbour: first in the gap after it, or last in the gap before it.
  const frIt = items.find((i) => i.key === 'freight#0');
  const rest = items.filter((i) => i !== frIt);
  return frIt && frIt.gap === 0 ? [...rest.filter((i) => i.anchor), frIt, ...rest.filter((i) => !i.anchor)] : [...rest, ...(frIt ? [frIt] : [])];
}

/** Which zone and sector a region is (by its band and centroid angle). */
function slotOf(t: Template, r: Region): { zone: number; sector: number } {
  const zone = Math.min(r.band, zonesOf(t).length - 1);
  const sec = sectors(t, zone);
  const a = ((r.a % TAU) + TAU) % TAU;
  const k = sec.findIndex(([a0, span]) => ((a - a0 + TAU) % TAU) < span);
  return { zone, sector: Math.max(0, k) };
}

export function assign(rng: Rng, t0: Template, depts: readonly Dept[]): Assignment | string {
  const t: Template = JSON.parse(JSON.stringify(t0)) as Template;
  const items = draw(rng, t, depts);
  const { R } = solve(t, items);
  if (R > 74) return 'too big';
  const s = rasterise(t, R);
  if (typeof s === 'string') return s;
  const { g } = s;
  // Anchored arcs: the harbour's share of the outer band, at least its dock bank and a wing either side.
  const outer = s.regions.filter((r) => r.band === 0 && r.hull).sort((a, b) => b.tiles.length - a.tiles.length)[0];
  if (!outer) return 'no outer band';
  for (const [k, it] of items.filter((i) => i.anchor).entries()) {
    const f = s.faces[k];
    if (!f || !it.anchor) continue;
    it.anchor.span = Math.max((it.weight / outer.tiles.length) * TAU, 2 * Math.atan((f.half + 7) / f.line));
  }
  const parcels: Parcel[] = [];
  const courts: number[][] = [];
  const used = new Set<Item>();
  for (const r of s.regions) {
    let its: Item[];
    if (r === outer) its = items.filter((i) => i.zone === 0);
    else if (t.kind === 'concourse') {
      // Concourse blocks: inner parts go to the blocks in turn, largest block first.
      its = [];
    } else {
      const { zone, sector } = slotOf(t, r);
      its = zone === 0 ? [] : items.filter((i) => i.zone === zone && i.sector === sector && !used.has(i));
    }
    if (its.length > 0) {
      for (const i of its) used.add(i);
      for (const [key, tiles] of cutRegion(g, r.tiles, its as unknown as Cut[], rng.next() * TAU)) {
        const [dept, part] = key.split('#') as [DeptId, string];
        parcels.push({ dept, part: Number(part), tiles });
      }
    } else if (t.kind !== 'concourse' || r === outer) courts.push(r.tiles);
  }
  if (t.kind === 'concourse') {
    const blocks = s.regions.filter((r) => r !== outer).sort((a, b) => b.tiles.length - a.tiles.length);
    const inner = items.filter((i) => i.zone === 1);
    const load = new Map<Region, Item[]>(blocks.map((b) => [b, []]));
    for (const it of [...inner].sort((a, b) => b.weight - a.weight)) {
      // To the block with the most floor left per need.
      const best = blocks.reduce((b, x) => (x.tiles.length - sumW(load.get(x)) > b.tiles.length - sumW(load.get(b)) ? x : b), blocks[0] as Region);
      load.get(best)?.push(it);
    }
    for (const [b, its] of load) {
      if (its.length === 0) { courts.push(b.tiles); continue; }
      for (const [key, tiles] of cutRegion(g, b.tiles, its as unknown as Cut[], rng.next() * TAU)) {
        const [dept, part] = key.split('#') as [DeptId, string];
        parcels.push({ dept, part: Number(part), tiles });
      }
    }
  } else if (items.some((i) => !i.anchor && i.zone !== 0 && !used.has(i))) return 'department without a region';
  return score(s, depts, { s, parcels, courts, score: 0, why: '' });
}

const sumW = (its: readonly Item[] | undefined): number => (its ?? []).reduce((a, i) => a + i.weight, 0);

const centroid = (g: Grid, ts: readonly number[]): [number, number] => {
  let x = 0, y = 0;
  for (const i of ts) { x += g.x(i); y += g.y(i); }
  return [x / Math.max(1, ts.length), y / Math.max(1, ts.length)];
};

function score(s: Structure, depts: readonly Dept[], a: Assignment): Assignment | string {
  const { g } = s;
  let v = 0;
  const free = s.regions.reduce((t, r) => t + r.tiles.length, 0);
  for (const p of a.parcels) {
    const d = depts.find((x) => x.id === p.dept) as Dept;
    const parts = a.parcels.filter((q) => q.dept === p.dept).length;
    const ratio = p.tiles.length / (d.need / parts);
    if (ratio < 0.8) return `${p.dept} short of floor`;
    if (ratio < 0.95) v -= 10 * (0.95 - ratio);
    if (ratio > 1.3) v -= 2 * (ratio - 1.3);
    const th = thickness(g, p.tiles);
    if (th < d.minDepth - 1) v -= 2 + (d.minDepth - 1 - th);
    // Rectangular facilities must each fit their parcel (the strategies pack them; this is the cheap check).
    const set = new Set(p.tiles);
    for (const f of d.facilities) {
      if (f.shape !== 'rect' || f.spec.role === 'dock') continue;
      if (f.spec.warehouse ? !fitsRect(g, set, 6, 4) : !fitsRect(g, set, f.spec.w, f.spec.h)) return `${f.spec.role} does not fit`;
    }
    // Habitation: the cabins must line its parcel at their fixed size.
    if (p.dept === 'habitation') {
      const beds = d.facilities.filter((f) => f.spec.role === 'quarters').length;
      const extras = p.part === 0 ? d.facilities.filter((f) => f.spec.role !== 'quarters') : [];
      if (!planCabins(g, p.tiles, Math.ceil(beds / parts), extras)) return 'cabins do not fit';
    }
    // Engineering: its machine rooms must pack behind the service aisle together (the strategy's own packer).
    if (p.dept === 'defence' && !rowFits(g, p.tiles, d.facilities.filter((f) => f.shape === 'rect').map((f) => [f.spec.w, f.spec.h]))) return 'gun bays do not pack';
    if (p.dept === 'engineering' && !machinesFit(g, p.tiles, d.facilities.filter((f) => f.shape === 'rect').map((f) => [f.spec.w, f.spec.h]))) return 'machine rooms do not pack';
  }
  const at = (id: DeptId): [number, number][] => a.parcels.filter((p) => p.dept === id).map((p) => centroid(g, p.tiles));
  const dist = (p: [number, number], q: [number, number]): number => Math.hypot(p[0] - q[0], p[1] - q[1]);
  for (const h of at('habitation')) for (const o of [...at('harbour'), ...at('harbour2'), ...at('engineering')]) v -= Math.max(0, 0.6 - dist(h, o) / s.R) * 3;
  // The market by a court (a court tile beside its floor).
  const court = new Set([...g.tiles((k) => k === K.Court), ...a.courts.flat()]);
  for (const p of a.parcels.filter((q) => q.dept === 'market')) if (p.tiles.some((i) => g.nb(i).some((j) => court.has(j)))) v += 1;
  const courtArea = a.courts.reduce((t, c) => t + c.length, 0);
  if (courtArea > free * 0.12) v -= 8 * (courtArea / free - 0.12);
  v -= 0.05 * s.R;
  return { ...a, score: v };
}
