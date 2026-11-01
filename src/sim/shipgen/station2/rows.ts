import type { RoomSpec } from '../plan';
import { DIRS8, K, type Grid } from './grid';
import { PREC, addRoom, depthFrom, faces, frontLength, isPublic, nearPublic, slice, sliceAlong, type Ctx2, type Door } from './kit';
import type { DeptId, Facility } from './program';

/**
 * Row strategies (docs/STATIONGEN2.md section 3.4): a parcel sliced along the ring into units of fixed size.
 *   cabins      one-bed cabins about three wide on the corridor face; the lounge in the middle of the run and the
 *               medbay at its busy end; floor to spare goes to stores, never to wider cabins. A deep parcel backed by
 *               the hull puts the cabins on the hull side off a private hallway; one between two corridors has a row
 *               facing each.
 *   storefront  equal shop units on the public face (on the court's side where there is one), the mess among them,
 *               stores behind in a deep parcel.
 */

const STORE: RoomSpec = { role: 'cargo', mods: ['module.storage_rack', 'module.storage_rack'], w: 3, h: 3 };
/** Front tiles a cabin takes (three of floor and its wall). */
const PITCH = 4;

interface Unit { spec: RoomSpec; weight: number }

/** Slice a row into units, each doored to `door` near the middle of its front. */
function row(c: Ctx2, dept: DeptId, tiles: number[], units: Unit[], door: Door, front: (i: number) => boolean): number[] {
  if (units.length === 0) units = [{ spec: { ...STORE }, weight: 1 }];
  const parts = sliceAlong(c.g, tiles, units.map((u) => u.weight), front);
  return units.map((u, k) => {
    const ts = parts[k] ?? [];
    const fr = ts.filter(front);
    return addRoom(c, { tiles: ts, spec: u.spec, dept, prec: PREC.soft + c.rooms.length, doors: [door], ...(fr.length > 0 ? { doorNear: fr[fr.length >> 1] as number } : {}) });
  });
}

/** Split a parcel's public front into its inner and outer side (by radius). */
function sides(c: Ctx2, tiles: readonly number[]): { inner: number[]; outer: number[] } {
  const g = c.g;
  return faces(g, tiles);
}

/** Units for a run of `n` front tiles: the extras' weights, cabins, then stores for floor to spare. */
function run(cabins: number, extras: Facility[], len: number): Unit[] | null {
  const cab: Unit = { spec: { role: 'quarters', mods: ['module.bed'], w: 3, h: 4, cabin: true }, weight: 1 };
  const ex = extras.map((f) => ({ spec: f.spec, weight: Math.max(1.5, (f.spec.w * f.spec.h) / 12) }));
  const used = cabins + ex.reduce((t, u) => t + u.weight, 0);
  const cap = len / PITCH;
  if (used > (len / 3) * 1.02) return null;
  const spare = Math.floor((cap - used) / 2);
  const stores = Array.from({ length: Math.max(0, spare) }, () => ({ spec: { ...STORE }, weight: 2 }));
  const cs = Array.from({ length: cabins }, () => ({ ...cab, spec: { ...cab.spec } }));
  // Medbay first (the busy end), the lounge and stores in the middle of the cabins.
  const med = ex.filter((u) => u.spec.role === 'medbay');
  const mid = [...ex.filter((u) => u.spec.role !== 'medbay'), ...stores];
  const h = cs.length >> 1;
  return [...med, ...cs.slice(0, h), ...mid, ...cs.slice(h)];
}

interface Row { tiles: number[]; units: Unit[]; front: Set<number>; hall: boolean }

interface HabPlan { rows: Row[]; hall: number[] }

/**
 * How a habitation parcel is laid out, or null if its cabins do not fit (also the assignment's feasibility check).
 *   between two corridors, deep enough: a row facing each
 *   one public side, deep: cabins four deep on the far side off a private hallway; the lounge, medbay and stores in a
 *   row on the public side when there is depth for one
 *   otherwise: one row facing the corridor
 */
export function planCabins(g: Grid, tiles: readonly number[], beds: number, extras: Facility[]): HabPlan | null {
  const fs = faces(g, tiles);
  const inner = new Set(fs.inner), outer = new Set(fs.outer);
  const front = inner.size >= outer.size ? inner : outer;
  const d = depthFrom(g, tiles, (i) => front.has(i));
  const th = Math.max(0, ...d.values());
  if (inner.size > 4 && outer.size > 4 && th >= 10) {
    const din = depthFrom(g, tiles, (i) => inner.has(i)), dout = depthFrom(g, tiles, (i) => outer.has(i));
    const a = tiles.filter((i) => (din.get(i) ?? 99) <= (dout.get(i) ?? 99)), b = tiles.filter((i) => (din.get(i) ?? 99) > (dout.get(i) ?? 99));
    const la = frontLength(g, a, (i) => inner.has(i)), lb = frontLength(g, b, (i) => outer.has(i));
    const na = Math.round((beds * la) / (la + lb));
    const ua = run(na, extras, la), ub = run(beds - na, [], lb);
    if (!ua || !ub) return null;
    const rows: Row[] = [{ tiles: a, units: ua, front: inner, hall: false }, { tiles: b, units: ub, front: outer, hall: false }];
    return { rows, hall: [] };
  }
  if (th >= 9) {
    // The hallway is two wide (three rows with its wall on the corridor side): cabins take the rest of the depth up to
    // six rows; a deeper parcel puts a row of rooms on the corridor in front of the hallway.
    const hasFront = th >= 13;
    const cut = hasFront ? th - 6 : 3;
    const cab = tiles.filter((i) => (d.get(i) ?? 0) > cut);
    const hall = tiles.filter((i) => { const k = d.get(i) ?? 0; return k <= cut && (!hasFront || k > cut - 2); });
    const hallSet = new Set(hall);
    const onHall = (i: number): boolean => g.nb(i, DIRS8).some((j) => hallSet.has(j));
    const cabFront = new Set(cab.filter(onHall));
    const units = run(beds, hasFront ? [] : extras, frontLength(g, cab, (i) => cabFront.has(i)));
    if (!units) return null;
    const rows: Row[] = [{ tiles: cab, units, front: cabFront, hall: true }];
    if (hasFront) {
      const ft = tiles.filter((i) => (d.get(i) ?? 0) <= cut - 2);
      const fu = run(0, extras, frontLength(g, ft, (i) => front.has(i)));
      if (!fu || fu.length === 0) return null;
      rows.push({ tiles: ft, units: fu, front, hall: false });
    }
    return { rows, hall };
  }
  const units = run(beds, extras, frontLength(g, tiles, (i) => front.has(i)));
  const one: Row = { tiles: [...tiles], units: units ?? [], front, hall: false };
  return units ? { rows: [one], hall: [] } : null;
}

export function cabinsStrategy(c: Ctx2, tiles: number[], beds: number, extras: Facility[]): boolean {
  const p = planCabins(c.g, tiles, beds, extras);
  if (!p) return false;
  const hallId = p.hall.length > 0 ? addRoom(c, { tiles: p.hall, spec: { role: 'hall', mods: [], w: 1, h: 1 }, dept: 'habitation', prec: PREC.inner + c.rooms.length, doors: ['public'] }) : -1;
  for (const r of p.rows) row(c, 'habitation', r.tiles, r.units, r.hall ? hallId : 'public', (i) => r.front.has(i));
  return true;
}

export function storefrontStrategy(c: Ctx2, tiles: number[], facilities: Facility[]): boolean {
  const g = c.g;
  const courtSide = tiles.filter((i) => g.nb(i).some((j) => g.pub[j] === 2));
  const { inner, outer } = sides(c, tiles);
  // The court's side, else the longer ring face, else (a narrow parcel by a spoke) any public side.
  const ring = inner.length >= outer.length ? inner : outer;
  const any = tiles.filter((i) => g.nb(i).some((j) => isPublic(g, j)));
  const front = new Set(courtSide.length >= 6 ? courtSide : frontLength(g, ring, () => true) >= 8 ? ring : any);
  const d = depthFrom(g, tiles, (i) => front.has(i));
  const th = Math.max(0, ...d.values());
  const deep = th >= 9;
  const shopRow = deep ? tiles.filter((i) => (d.get(i) ?? 99) <= 5) : tiles;
  const len = frontLength(g, shopRow, (i) => front.has(i));
  const shops = facilities.filter((f) => f.spec.role === 'shop');
  const others = facilities.filter((f) => f.spec.role !== 'shop');
  // Shops about four to five front tiles each; more shops where the face is long.
  const extraW = others.reduce((t, f) => t + Math.max(2, (f.spec.w * f.spec.h) / 10), 0);
  // Shops about four to five front tiles each, more where the face is long, but no more than the row's floor holds
  // at their size (a 3 x 4 floor with its walls, about 20 tiles).
  const room = shopRow.length - others.reduce((t, f) => t + (f.spec.w + 1) * (f.spec.h + 1), 0);
  const n = Math.max(1, Math.min(shops.length + 3, Math.round((len / 4.5) - extraW), Math.floor(room / 20)));
  if (n + extraW > len / 3) return false;
  const shopSpec = (shops[0]?.spec ?? { role: 'shop', mods: [], w: 3, h: 4 }) as RoomSpec;
  const units: Unit[] = Array.from({ length: n }, () => ({ spec: { ...shopSpec }, weight: 1 }));
  const h = units.length >> 1;
  units.splice(h, 0, ...others.map((f) => ({ spec: f.spec, weight: Math.max(2, (f.spec.w * f.spec.h) / 10) })));
  const ids = row(c, 'market', shopRow, units, 'public', (i) => front.has(i));
  if (deep) {
    const back = tiles.filter((i) => (d.get(i) ?? 99) > 5);
    const backFront = back.filter((i) => nearPublic(g, i));
    // Back of house: stores, opening on the far corridor if there is one, else onto the shop in front.
    const k = Math.max(1, Math.round(frontLength(g, back, () => true) / 30));
    const parts = slice(g, back, Array<number>(k).fill(1));
    for (const ts of parts) {
      if (ts.length === 0) continue;
      const pub = ts.some((i) => backFront.includes(i));
      const near = ids.find((id) => ts.some((i) => g.nb(i).some((j) => c.g.id[j] === id && g.kind[j] === K.Room)));
      addRoom(c, { tiles: ts, spec: { ...STORE }, dept: 'market', prec: PREC.soft + c.rooms.length, doors: [pub ? 'public' : (near ?? 'public')] });
    }
  }
  return true;
}
