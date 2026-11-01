import type { Rng } from '../../rng';
import { DIRS8, K, rectSpots, type Grid } from './grid';
import { machinesFit, rowFits } from './machine';
import { cutRegion, type Cut } from './parcels';
import { planCabins } from './rows';
import type { Dept, DeptId } from './program';
import { rasterise, type Region, type Structure } from './structure';
import { dirAngle, type Ring, type Template } from './template';

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

/** A department part's floor, and the floor it needs (its demand, for the waste ratio). */
export interface Parcel { dept: DeptId; part: number; tiles: number[]; need: number }

export interface Assignment {
  s: Structure;
  parcels: Parcel[];
  /** Regions left as courts. */
  courts: number[][];
  /** Floor no department needs that borders space: left open (negative space). */
  voids: number[][];
  score: number;
  /** Why a draw was rejected (hard failures), empty if feasible. */
  why: string;
  /** The department whose parcel failed (for the debug view). */
  bad?: DeptId;
  /** Public circulation's share of the floor inside the hull. */
  corridor?: number;
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
  // Spokes cutting the zone: the middle band of a concentric station (z 1) is cut by spokes reaching the outer ring.
  const from = t.kind === 'concentric' && z === 1 ? 1 : -1;
  const cutting = t.spokes.filter((s) => (s.from <= from || s.from === -1) && !(t.kind === 'concentric' && z === 1 && s.reach > 0));
  return [...new Set(cutting.map((s) => dirAngle(s.dir)))].sort((a, b) => a - b);
}

/** Sector spans of a zone: [a0, span] between consecutive spokes (one full sector without). */
function sectors(t: Template, z: number): [number, number][] {
  const c = cuts(t, z);
  if (c.length === 0) return [[0, TAU]];
  return c.map((a, k) => [a, (((c[(k + 1) % c.length] as number) - a + TAU) % TAU) || TAU]);
}


/** The zones a family has, outside in. */
const zonesOf = (t: Template): number[] => (t.kind === 'concentric' ? [0, 1, 2] : [0, 1]);

/** A wheel's filled quarter: its sector of the rim's inner band runs on in to the hub (a pie with two straight sides). */
function filled(t: Template, z: number, s: number): boolean {
  if (t.kind !== 'wheel' || z !== 1) return false;
  const [a0] = sectors(t, z)[s] as [number, number];
  return !t.open.some(([o]) => Math.abs(norm(o - a0)) < 1e-6);
}


/**
 * The natural depth of an item's parcel in its zone and sector: its department's depth (two rows between two faces),
 * and for rect rooms the depth their largest room takes standing square on the axes at the sector's tilt (a room
 * askew to the band takes its diagonal), plus the aisle.
 */
function depthOf(t: Template, it: Item): number {
  const d = it.dept;
  let v = twoFaced(t, it.zone) && d.depth2 ? d.depth2 : d.minDepth;
  if (d.rect && !filled(t, it.zone, it.sector)) {
    // Its rooms stand in a row on a straight aisle laid along the band's inner edge at the axis: the band must reach
    // past the row's far corners, (along / 2) either side of the axis.
    const r = Math.max(4, t.radii?.[it.zone] ?? (it.zone === 0 ? 25 : 8));
    const along = d.need / d.minDepth;
    const deep = d.rect[0] + 3;
    v = Math.max(v, Math.ceil(Math.hypot(r + deep, along / 2) - r));
  }
  return v;
}

/**
 * The floor an item takes in its zone of depth D: a row department (cabins, shops) needs its front however deep the
 * zone is, so in a deep zone it takes front times depth (half that where the zone holds two rows).
 */
function weightIn(t: Template, it: Item, D: number): number {
  const f = it.dept.front;
  if (!f) {
    // A rect department askew to its band loses floor round its rooms in proportion to the extra depth they take.
    return it.dept.rect ? it.weight * Math.max(1, depthOf(t, it) / it.dept.minDepth) : it.weight;
  }
  const rows = twoFaced(t, it.zone) && D >= 11 ? 2 : 1;
  return Math.max(it.weight, ((f * it.weight) / it.dept.need) * D / rows);
}

/** Zones with public floor on both faces (a concentric station's bands between its rings and round the rotunda). */
const twoFaced = (t: Template, z: number): boolean => t.kind === 'concentric' && z > 0;

/** Each zone's depth: the deepest natural depth of its items (the outer band at least the template's). */
function zoneDepths(t: Template, items: readonly Item[]): number[] {
  return zonesOf(t).map((z) => {
    const ds = items.filter((i) => i.zone === z).map((i) => depthOf(t, i));
    return z === 0 ? Math.max(t.outer, ...ds) : ds.length > 0 ? Math.max(...ds) : 0;
  });
}

interface Solved { R: number; waste: number; depths: number[] }

/**
 * Size the station up front (the template is updated in place). Every band takes its natural depth; the centre (the
 * rotunda court, or the wheel's open hollow) is the one free size, grown until every band's busiest sector has the
 * arc it needs. Floor a sector has beyond its need is the draw's waste (it becomes court or open space).
 */
function solve(t: Template, items0: readonly Item[]): Solved {
  const D = zoneDepths(t, items0);
  const items = items0.map((i) => ({ ...i, weight: weightIn(t, i, D[i.zone] as number) }));
  const need = (z: number, s: number): number => items.filter((i) => i.zone === z && i.sector === s).reduce((a, i) => a + i.weight, 0);
  // The template's own centre radius (solving grows t.rc; every solve starts from the template's).
  t.rcMin ??= t.rc;
  const hub = t.rcMin + 0.5;
  // The least inner radius at which zone z (depth d) holds its busiest sector.
  const req = (z: number, d: number): number => {
    if (d <= 0) return 0;
    return Math.max(0, ...sectors(t, z).map(([, span], s) => {
      const n = need(z, s) / NET;
      if (filled(t, z, s)) return Math.sqrt(hub * hub + (2 * n) / span) - d;
      return n / (span * d) - d / 2;
    }));
  };
  const area = (z: number, s: number, a: number, d: number): number => {
    const span = (sectors(t, z)[s] as [number, number])[1];
    return 0.5 * span * ((a + d) ** 2 - (filled(t, z, s) ? hub * hub : a * a)) * NET;
  };
  const w0 = t.rings[0]?.w ?? 2, w1 = t.rings[1]?.w ?? 2;
  let a: number, inner: number;
  const bands: number[] = [];
  let waste = 0;
  if (t.kind === 'concentric') {
    const [d0, d1, d2] = D as [number, number, number];
    if (t.rings.length > 1 && d1 > 0 && d2 > 0) {
      // Two rings: inner radius of the inner zone (the rotunda's edge), out to whatever the zones outside it need.
      const a2 = Math.max(hub, req(2, d2), req(1, d1) - d2 - w1, req(0, d0) - d1 - w0 - d2 - w1);
      waste += Math.PI * (a2 * a2 - hub * hub) * 0.6;
      t.rc = a2 - 0.5;
      inner = a2;
      const a1 = a2 + d2 + w1;
      a = a1 + d1 + w0;
      bands.push(d0, d1);
      t.radii = [a, a1, a2];
      for (const [z, az, dz] of [[1, a1, d1], [2, a2, d2]] as const) sectors(t, z).forEach((_, s) => { if (dz > 0) waste += Math.max(0, area(z, s, az, dz) - need(z, s)); });
    } else {
      // One ring: the inner ring is not built when only one band inside the outer ring has departments; that band runs
      // from the outer ring to the rotunda.
      const z = d1 > 0 ? 1 : 2, dz = Math.max(d1, d2);
      const ai = Math.max(hub, req(z, dz), req(0, d0) - dz - w0);
      waste += Math.PI * (ai * ai - hub * hub) * 0.6;
      t.rc = ai - 0.5;
      inner = ai;
      a = ai + dz + w0;
      bands.push(d0);
      t.radii = [a, ai, ai];
      if (dz > 0) sectors(t, z).forEach((_, s) => { waste += Math.max(0, area(z, s, ai, dz) - need(z, s)); });
    }
  } else if (t.kind === 'wheel') {
    const [d0, d1] = D as [number, number];
    // The hollow (open space between hub and rim) grows until the rim holds what it needs.
    const a1 = Math.max(hub + 4, req(1, d1), req(0, d0) - d1 - w0);
    inner = a1;
    a = a1 + d1 + w0;
    bands.push(d0, d1);
    t.radii = [a, a1];
    sectors(t, 1).forEach((_, s) => { waste += Math.max(0, area(1, s, a1, d1) - need(1, s)) * 0.5; });
  } else {
    // Concourse: the inner disc holds its departments and the streets across it.
    const n = items.filter((i) => i.zone === 1).reduce((s, i) => s + i.weight, 0);
    const r = Math.max(10, Math.sqrt(n / (Math.PI * 0.8)), req(0, D[0] as number) - w0);
    waste += Math.PI * r * r * 0.8 - n;
    inner = r;
    a = r + w0;
    bands.push(D[0] as number);
    t.radii = [a, r / 2];
  }
  void inner;
  const d0 = D[0] as number;
  const capOut = Math.PI * ((a + d0) ** 2 - a * a) * NET;
  waste += Math.max(0, capOut - need(0, 0));
  t.bands = bands;
  return { R: Math.ceil(a + d0 - 0.5), waste, depths: D };
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
    const pref = its.filter((i) => i.dept.id === 'market' && t.kind === 'concentric' && i.zone >= 1).length * -20
      + its.filter((i) => i.dept.id === 'engineering' && t.kind === 'wheel' && filled(t, i.zone, i.sector)).length * -30;
    return 3 * R + Math.max(0, waste) / 4 + pref;
  };
  const slots = zones.flatMap((z) => sectors(t, z).map((_, s) => ({ z, s })));
  // A department deeper than the outer band stays out of it (it would deepen the whole band).
  const fits = (it: Item, z: number): boolean => z !== 0 || depthOf(t, { ...it, zone: 0 }) <= t.outer + 1;
  // Greedy, parts in a random order, each where the station stays smallest with the least floor to spare (with noise).
  for (const it of parts.map((p) => ({ p, k: rng.next() })).sort((a, b) => a.k - b.k).map((x) => x.p)) {
    let best = slots[0] as { z: number; s: number }, top = Infinity;
    for (const sl of slots.filter((q) => fits(it, q.z))) {
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
    if (!fits(it, sl.z)) continue;
    const was = { zone: it.zone, sector: it.sector, gap: it.gap };
    it.zone = sl.z; it.sector = sl.s; it.gap = sl.z === 0 ? rng.int(0, gaps - 1) : undefined;
    const v = cost(items);
    if (v <= now) now = v; else Object.assign(it, was);
  }
  return items;
}

/**
 * The outer band's free parts into the gaps between the anchored harbours, by the gaps' floor: freight in the larger
 * gap beside the first harbour (first after it or last before it), the rest largest first to the gap with most floor
 * left. Gap k is the one after the k-th anchor in angle order (as cutRegion reads them). Items are reordered in place.
 */
function gaps(rng: Rng, items: Item[], floor: number): void {
  const anchors = items.filter((i) => i.anchor).sort((a, b) => norm(a.anchor!.a) - norm(b.anchor!.a));
  const n = anchors.length;
  if (n === 0) return;
  const span = anchors.map((a, k) => {
    const b = anchors[(k + 1) % n] as Item;
    const s = norm(b.anchor!.a - b.anchor!.span / 2 - (a.anchor!.a + a.anchor!.span / 2));
    return n === 1 ? TAU - a.anchor!.span : s;
  });
  const left = span.map((s) => (s / TAU) * floor);
  const outer = items.filter((i) => i.zone === 0 && !i.anchor);
  const fr = outer.find((i) => i.key === 'freight#0');
  const h0 = anchors.findIndex((a) => a.key.startsWith('harbour#'));
  let frFirst = true;
  if (fr) {
    const after = h0, before = (h0 - 1 + n) % n;
    fr.gap = (left[after] as number) >= (left[before] as number) ? after : before;
    frFirst = fr.gap === after && !(n === 1 && rng.chance(0.5));
    left[fr.gap] = (left[fr.gap] as number) - fr.weight;
  }
  for (const it of outer.filter((i) => i !== fr).sort((a, b) => b.weight - a.weight)) {
    const k = left.reduce((b, v, j) => (v > (left[b] as number) ? j : b), 0);
    it.gap = k;
    left[k] = (left[k] as number) - it.weight;
  }
  // Order inside a gap: shuffled, freight at its harbour's end.
  const rest = outer.filter((i) => i !== fr).map((i) => ({ i, k: rng.next() })).sort((a, b) => a.k - b.k).map((x) => x.i);
  const others = items.filter((i) => i.zone !== 0 || i.anchor);
  items.length = 0;
  items.push(...others.filter((i) => i.anchor), ...(fr && frFirst ? [fr] : []), ...rest, ...(fr && !frFirst ? [fr] : []), ...others.filter((i) => !i.anchor));
}

const norm = (a: number): number => ((a % TAU) + TAU) % TAU;

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
  justify(t, items);
  const solved = solve(t, items);
  const { R } = solved;
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
    // A harbour needs at least its dock bank and a wing either side, whatever its floor.
    const least = 2 * Math.atan((f.half + 6) / f.line);
    it.weight = Math.max(it.weight, (least / TAU) * outer.tiles.length * NET);
    it.anchor.span = (it.weight / NET / outer.tiles.length) * TAU;
  }
  for (const it of items) it.weight = weightIn(t, it, solved.depths[it.zone] as number);
  // A rect department in the outer band stands square on a free axis (rooms askew to a curved band waste it).
  const taken = new Set(t.harbours.map((h) => h.dir as number));
  for (const it of items.filter((i) => i.zone === 0 && i.dept.rect && !i.anchor)) {
    const free = [0, 2, 4, 6].filter((d) => !taken.has(d));
    if (free.length === 0) break;
    const d = free[rng.int(0, free.length - 1)] as number;
    taken.add(d);
    it.anchor = { a: dirAngle(d), span: (it.weight / NET / outer.tiles.length) * TAU };
  }
  gaps(rng, items, outer.tiles.length);
  const parcels: Parcel[] = [];
  const courts: number[][] = [];
  const voids: number[][] = [];
  const nearSpace = (ts: readonly number[]): boolean => ts.some((i) => g.nb(i, DIRS8).some((j) => g.kind[j] === K.Space || g.kind[j] === K.Open));
  // Floor nobody needs: open space where it borders space, else a court.
  const spare = (ts: number[]): void => { if (ts.length > 0) (nearSpace(ts) ? voids : courts).push(ts); };
  /** Cut a region among its items; past its need, a sector's floor is left spare at the run's end (inner zones). */
  const cut = (tiles: number[], its: Item[], outerBand: boolean): void => {
    const want = its.reduce((t2, i) => t2 + i.weight, 0) / NET;
    const extra = tiles.length - want;
    const cuts: Cut[] = [...(its as unknown as Cut[])];
    // Spare floor is left open only beside space (the edge of a wheel's hollow); elsewhere the departments take it
    // (as stores and plant rooms), scored by the waste ratio: a court is never the sink for surplus.
    if (!outerBand && extra > 0.12 * tiles.length && nearSpace(tiles)) cuts.push({ key: 'spare#0', weight: extra * NET, gap: 0 });
    for (const [key, ts] of cutRegion(g, tiles, cuts, rng.next() * TAU)) {
      const [dept, part] = key.split('#') as [DeptId | 'spare', string];
      if (dept === 'spare') spare(ts); else parcels.push({ dept, part: Number(part), tiles: ts, need: (its.find((i) => i.key === key)?.weight ?? 0) / NET });
    }
  };
  const used = new Set<Item>();
  for (const r of s.regions) {
    let its: Item[];
    if (r === outer) its = items.filter((i) => i.zone === 0);
    else if (t.kind === 'concourse') continue;
    else {
      const { zone, sector } = slotOf(t, r);
      its = zone === 0 ? [] : items.filter((i) => i.zone === zone && i.sector === sector && !used.has(i));
    }
    if (its.length > 0) {
      for (const i of its) used.add(i);
      if (r !== outer) axisAnchor(t, r, its);
      cut(r.tiles, its, r === outer);
    } else spare(r.tiles);
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
    for (const [b, its] of load) if (its.length === 0) spare(b.tiles); else cut(b.tiles, its, false);
  } else if (items.some((i) => !i.anchor && i.zone !== 0 && !used.has(i))) return 'department without a region';
  return score(s, depts, { s, parcels, courts, voids, score: 0, why: '' });
}

/**
 * In an inner sector that spans an axis, the first rect department is centred on that axis (its rooms stand square
 * there); the others fill the rest of the sector.
 */
function axisAnchor(t: Template, r: Region, its: Item[]): void {
  const it = its.find((i) => i.dept.rect);
  if (!it || filled(t, it.zone, it.sector)) return;
  const [a0, span] = sectors(t, it.zone)[it.sector] as [number, number];
  let best = -1, mid = Infinity;
  for (let k = 0; k < 4; k++) {
    const d = norm(k * (Math.PI / 2) - a0);
    if (d > 0.3 && d < span - 0.3 && Math.abs(d - span / 2) < mid) { mid = Math.abs(d - span / 2); best = k; }
  }
  if (best < 0) return;
  it.anchor = { a: best * (Math.PI / 2), span: Math.min(span * 0.9, ((it.weight / NET) / r.tiles.length) * span) };
  for (const o of its) if (o !== it) o.gap = 0;
}

/**
 * Build only the circulation the departments use (a concentric station). The inner ring stands only when both bands
 * either side of it hold departments; without it the band with departments runs from the outer ring to the rotunda
 * (spokes that only reached the inner ring go, or run on to the outer ring if they bounded that band's sectors). Then a
 * spoke that only bounds a sector no department took is dropped, merging that sector into its neighbour; the harbour
 * concourses always stay.
 */
function justify(t: Template, items: Item[]): void {
  if (t.kind !== 'concentric') return;
  const has = (z: number): boolean => items.some((i) => i.zone === z);
  if (t.rings.length > 1 && !(has(1) && has(2))) {
    t.rings = [t.rings[0] as Ring];
    if (has(2)) {
      for (const sp of t.spokes) sp.reach = 0;
      for (const i of items) if (i.zone === 2) i.zone = 1;
    } else t.spokes = t.spokes.filter((sp) => sp.reach === 0);
  }
  const z = t.rings.length > 1 ? 2 : 1;
  const faces = new Set(t.harbours.map((h) => h.dir as number));
  for (;;) {
    const sec = sectors(t, z);
    if (sec.length < 2) return;
    const empty = sec.findIndex((_, k) => !items.some((i) => i.zone === z && i.sector === k));
    if (empty < 0) return;
    const [a0, span] = sec[empty] as [number, number];
    const ends = [a0, a0 + span];
    const drop = t.spokes.find((sp) => !faces.has(sp.dir) && ends.some((e) => Math.abs(wrapA(dirAngle(sp.dir) - e)) < 1e-6));
    if (!drop) return;
    // Items keep their place by angle: each moves to the merged sector holding its old sector's middle.
    const mids = items.filter((i) => i.zone === z).map((i) => { const [b0, sp] = sec[i.sector] as [number, number]; return [i, b0 + sp / 2] as const; });
    t.spokes = t.spokes.filter((sp) => sp !== drop);
    const now = sectors(t, z);
    for (const [i, m] of mids) i.sector = Math.max(0, now.findIndex(([b0, sp]) => norm(m - b0) < sp));
  }
}

const wrapA = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

const sumW = (its: readonly Item[] | undefined): number => (its ?? []).reduce((a, i) => a + i.weight, 0);

const centroid = (g: Grid, ts: readonly number[]): [number, number] => {
  let x = 0, y = 0;
  for (const i of ts) { x += g.x(i); y += g.y(i); }
  return [x / Math.max(1, ts.length), y / Math.max(1, ts.length)];
};

function score(s: Structure, depts: readonly Dept[], a: Assignment): Assignment {
  const { g } = s;
  let v = 0;
  const free = s.regions.reduce((t, r) => t + r.tiles.length, 0);
  for (const p of a.parcels) {
    const d = depts.find((x) => x.id === p.dept) as Dept;
    const parts = a.parcels.filter((q) => q.dept === p.dept).length;
    // Waste inside the parcel: its floor over its demand (rooms at target size and the department's own circulation).
    const ratio = p.tiles.length / Math.max(1, p.need);
    const fail = (why: string): Assignment => ({ ...a, score: -Infinity, why, bad: p.dept });
    if (ratio < 0.85) return fail(`${p.dept} short of floor`);
    if (ratio > 1.6 && !d.docks) return fail(`${p.dept} parcel ${ratio.toFixed(1)}x its need`);
    if (ratio < 1) v -= 10 * (1 - ratio);
    if (ratio > 1.3) v -= 6 * (ratio - 1.3);
    // Rectangular facilities must each fit their parcel (the strategies pack them; this is the cheap check).
    const set = new Set(p.tiles);
    for (const f of d.facilities) {
      if (f.shape !== 'rect' || f.spec.role === 'dock') continue;
      if (f.spec.warehouse ? !fitsRect(g, set, 6, 4) : !fitsRect(g, set, f.spec.w, f.spec.h)) return fail(`${f.spec.role} does not fit`);
    }
    // Habitation: the cabins must line its parcel at their fixed size.
    if (p.dept === 'habitation') {
      const beds = d.facilities.filter((f) => f.spec.role === 'quarters').length;
      const extras = p.part === 0 ? d.facilities.filter((f) => f.spec.role !== 'quarters') : [];
      if (!planCabins(g, p.tiles, Math.ceil(beds / parts), extras)) return fail('cabins do not fit');
    }
    // Engineering: its machine rooms must pack behind the service aisle together (the strategy's own packer).
    if (p.dept === 'defence' && !rowFits(g, p.tiles, d.facilities.filter((f) => f.shape === 'rect').map((f) => [f.spec.w, f.spec.h]))) return fail('gun bays do not pack');
    if (p.dept === 'engineering' && !machinesFit(g, p.tiles, d.facilities.filter((f) => f.shape === 'rect').map((f) => [f.spec.w, f.spec.h]))) return fail('machine rooms do not pack');
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
  // Public circulation's share of the floor: a soft target of about a fifth (flagged above 0.3).
  const inside = g.tiles((k) => k !== K.Space && k !== K.Open).length;
  const corridor = g.tiles((k) => k === K.Hall).length / Math.max(1, inside);
  v -= 15 * Math.max(0, corridor - 0.22);
  return { ...a, score: v, corridor };
}
