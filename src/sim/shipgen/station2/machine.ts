import type { RoomSpec } from '../plan';
import { K, type Grid, type TileRect } from './grid';
import { PREC, addRoom, depthFrom, isPublic, nearPublic, placeRect, rectParts, slice, solid, type Ctx2 } from './kit';
import type { DeptId, Facility } from './program';
import { planSpine } from './spine';

/**
 * Rectangle strategies (docs/STATIONGEN2.md section 3.4). The parcel's public side becomes an aisle; rectangular rooms
 * are packed behind it against the far side, sharing walls in a row, each with its walls marked solid so it keeps its
 * exact interior. A room the aisle does not reach (on a ring's diagonal the aisle steps away from a straight wall) gets
 * a short service passage to it. Leftover floor becomes rooms off the aisle.
 *   machine    engineering: rooms sized by their design; the aisle is the service corridor, entered only through the
 *              guard post in its middle; leftovers become plant rooms
 *   warehouse  freight: holds as large as the parcel allows (crates shared by area); the aisle continues the harbour
 *              hall, so the holds open onto it; leftovers become stores
 */

const AISLE = 3;

/** The aisle (public side, AISLE deep) and the back of a parcel; the aisle's floor is all but its first row. */
export function split(g: Grid, tiles: readonly number[]): { aisle: number[]; back: number[]; floor: Set<number>; depth: Map<number, number> } {
  const fr = tiles.filter((i) => nearPublic(g, i));
  const mid = tiles.reduce((t, i) => t + g.r(i), 0) / Math.max(1, tiles.length);
  const inner = fr.filter((i) => g.r(i) < mid), outer = fr.filter((i) => g.r(i) >= mid);
  const side = new Set(inner.length >= outer.length ? inner : outer);
  const depth = depthFrom(g, tiles, (i) => side.has(i));
  const aisle = tiles.filter((i) => (depth.get(i) ?? 99) <= AISLE);
  return { aisle, back: tiles.filter((i) => (depth.get(i) ?? 99) > AISLE), floor: new Set(aisle.filter((i) => (depth.get(i) ?? 0) >= 2)), depth };
}

/** Pack rectangles (interior sizes, in order) into `back`: against the far side, sharing walls, near the aisle. */
function pack(g: Grid, back: readonly number[], depth: ReadonlyMap<number, number>, sizes: readonly [number, number][]): { rects: TileRect[]; rings: Set<number> } | null {
  const free = new Set(back);
  const backSet = new Set(back);
  const far = (j: number): boolean => !backSet.has(j) && !isPublic(g, j) && (depth.get(j) ?? 99) > AISLE;
  const rings = new Set<number>();
  const out: TileRect[] = [];
  for (const [w, h] of sizes) {
    const r = placeRect(g, new Set([...free, ...rings]), w, h, (r) => {
      const { inner, ring } = rectParts(g, r);
      if (inner.some((i) => rings.has(i))) return -Infinity;
      let v = 0, near = 99;
      for (const i of ring) {
        if (rings.has(i)) v += 3;
        if (g.nb(i).some(far)) v += 2;
        near = Math.min(near, depth.get(i) ?? 99);
      }
      return v - 2 * (near - AISLE - 1);
    });
    if (!r) return null;
    const { inner, ring } = rectParts(g, r);
    for (const i of [...inner, ...ring]) free.delete(i);
    for (const i of ring) rings.add(i);
    out.push(r);
  }
  return { rects: out, rings };
}

/** Ring tiles of a rect, not corners, with the tile just outside each. */
function sides(g: Grid, r: TileRect): [number, number][] {
  const out: [number, number][] = [];
  for (let x = r.x + 1; x < r.x + r.w - 1; x++) { out.push([g.idx(x, r.y), g.idx(x, r.y - 1)]); out.push([g.idx(x, r.y + r.h - 1), g.idx(x, r.y + r.h)]); }
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) { out.push([g.idx(r.x, y), g.idx(r.x - 1, y)]); out.push([g.idx(r.x + r.w - 1, y), g.idx(r.x + r.w, y)]); }
  return out;
}

/** Service passages: for each rect the aisle does not reach straight through a wall, the shortest way to it. */
function connect(g: Grid, rects: readonly TileRect[], rings: ReadonlySet<number>, back: readonly number[], floor: ReadonlySet<number>): Set<number> | null {
  const corridor = new Set(floor);
  const blocked = new Set(rings);
  for (const r of rects) for (const i of rectParts(g, r).inner) blocked.add(i);
  const open = new Set(back.filter((i) => !blocked.has(i)));
  const paths = new Set<number>();
  for (const r of rects) {
    const outs = sides(g, r).map(([, o]) => o);
    if (outs.some((o) => corridor.has(o))) continue;
    const prev = new Map<number, number>();
    let q = outs.filter((o) => open.has(o));
    for (const o of q) prev.set(o, -1);
    let hit = -1;
    while (q.length > 0 && hit < 0) {
      const next: number[] = [];
      for (const i of q) {
        if (g.nb(i).some((j) => corridor.has(j))) { hit = i; break; }
        for (const j of g.nb(i)) if (open.has(j) && !prev.has(j)) { prev.set(j, i); next.push(j); }
      }
      q = next;
    }
    if (hit < 0) return null;
    for (let i = hit; i >= 0; i = prev.get(i) ?? -1) { paths.add(i); corridor.add(i); }
  }
  return paths;
}

interface RectLayout { aisle: number[]; back: number[]; rects: TileRect[]; rings: Set<number>; paths: Set<number>; order: number[] }

/** Pack and connect in the first order that works: largest first, then deepest first. */
function layoutRects(g: Grid, tiles: readonly number[], sizes: readonly [number, number][]): RectLayout | null {
  const { aisle, back, floor, depth } = split(g, tiles);
  const idx = sizes.map((_, k) => k);
  const area = (k: number): number => (sizes[k] as [number, number])[0] * (sizes[k] as [number, number])[1];
  const minSide = (k: number): number => Math.min(...(sizes[k] as [number, number]));
  for (const order of [[...idx].sort((a, b) => area(b) - area(a)), [...idx].sort((a, b) => minSide(b) - minSide(a) || area(b) - area(a))]) {
    const p = pack(g, back, depth, order.map((k) => sizes[k] as [number, number]));
    const paths = p ? connect(g, p.rects, p.rings, back, floor) : null;
    if (p && paths) return { aisle, back, rects: p.rects, rings: p.rings, paths, order };
  }
  return null;
}

/** Can a parcel hold these machine rooms on a straight service corridor? (The assignment's feasibility check.) */
export const machinesFit = (g: Grid, tiles: readonly number[], sizes: readonly [number, number][]): boolean => planSpine(g, tiles, sizes) !== null || layoutRects(g, tiles, sizes) !== null;

/** Can a parcel hold these rooms behind an aisle along its public side? */
export const rowFits = (g: Grid, tiles: readonly number[], sizes: readonly [number, number][]): boolean => layoutRects(g, tiles, sizes) !== null;

/** Back floor no rect took: rooms where big enough and beside a corridor, else part of a corridor, else solid. */
function leftovers(c: Ctx2, dept: DeptId, back: readonly number[], halls: readonly number[], spec: () => RoomSpec): void {
  const g = c.g;
  for (const comp of g.components(back.filter((i) => g.kind[i] === K.Free))) {
    const touch = halls.filter((h) => comp.some((i) => g.nb(i).some((j) => g.kind[j] === K.Room && g.id[j] === h)));
    if (touch.length > 0 && comp.length >= 8) addRoom(c, { tiles: comp, spec: spec(), dept, prec: PREC.soft + c.rooms.length, doors: [{ any: touch }] });
    else if (touch.length > 0) { const h = touch[0] as number; for (const i of comp) g.set(i, K.Room, h); (c.rooms[h] as { tiles: number[] }).tiles.push(...comp); }
    else solid(c, comp);
  }
}

const hallSpec = (): RoomSpec => ({ role: 'hall', mods: [], w: 1, h: 1 });

export function machineStrategy(c: Ctx2, tiles: number[], facilities: Facility[]): boolean {
  const g = c.g;
  const rects = facilities.filter((f) => f.shape === 'rect');
  const sizes = rects.map((f) => [f.spec.w, f.spec.h] as [number, number]);
  const sp = planSpine(g, tiles, sizes);
  if (!sp) return aisleMachines(c, tiles, rects, facilities.find((f) => f.shape === 'soft'));
  for (const r of sp.rects) solid(c, rectParts(g, r).ring);
  const guard = facilities.find((f) => f.shape === 'soft');
  const hall = addRoom(c, { tiles: sp.corridor, spec: hallSpec(), dept: 'engineering', prec: PREC.inner + c.rooms.length, doors: [] });
  const post = addRoom(c, { tiles: sp.post.filter((i) => g.kind[i] === K.Free), spec: guard?.spec ?? { role: 'armoury', mods: [], w: 3, h: 3 }, dept: 'engineering', prec: PREC.inner + 1e4, doors: ['public', hall] });
  rects.forEach((f, k) => {
    addRoom(c, { tiles: rectParts(g, sp.rects[k] as TileRect).inner, spec: { ...f.spec }, dept: 'engineering', prec: PREC.rect + c.rooms.length, doors: [hall] });
  });
  // Leftovers: plant rooms off the corridor; floor only the public side reaches becomes a store there; the rest solid.
  for (const comp of g.components(tiles.filter((i) => g.kind[i] === K.Free))) {
    const touch = (id: number): boolean => comp.some((i) => g.nb(i).some((j) => g.kind[j] === K.Room && g.id[j] === id));
    if (comp.length >= 8 && (touch(hall) || touch(post))) addRoom(c, { tiles: comp, spec: { role: 'plant', mods: [], w: 3, h: 3 }, dept: 'engineering', prec: PREC.soft + c.rooms.length, doors: [{ any: [hall, post] }] });
    else if (comp.length >= 10 && comp.some((i) => nearPublic(g, i))) addRoom(c, { tiles: comp, spec: { role: 'cargo', mods: ['module.storage_rack', 'module.storage_rack'], w: 3, h: 3 }, dept: 'engineering', prec: PREC.soft + c.rooms.length, doors: ['public'] });
    else solid(c, comp);
  }
  return true;
}

/** Machine rooms behind an aisle along the public side, the guard post in its middle (when no straight corridor fits). */
function aisleMachines(c: Ctx2, tiles: number[], rects: Facility[], guard: Facility | undefined): boolean {
  const g = c.g;
  const lay = layoutRects(g, tiles, rects.map((f) => [f.spec.w, f.spec.h]));
  if (!lay) return false;
  solid(c, lay.rings);
  const [left, post, right] = slice(g, lay.aisle, [1, 0.12, 1]) as [number[], number[], number[]];
  const postSet = new Set(post);
  const halls: number[] = [];
  for (const comp of g.components([...left, ...right, ...lay.paths].filter((i) => !postSet.has(i)))) {
    halls.push(addRoom(c, { tiles: comp, spec: hallSpec(), dept: 'engineering', prec: PREC.inner + c.rooms.length, doors: [] }));
  }
  addRoom(c, { tiles: post, spec: guard?.spec ?? { role: 'armoury', mods: [], w: 3, h: 3 }, dept: 'engineering', prec: PREC.inner + 1e4, doors: ['public', ...halls] });
  lay.order.forEach((k, j) => {
    addRoom(c, { tiles: rectParts(g, lay.rects[j] as TileRect).inner, spec: { ...(rects[k] as Facility).spec }, dept: 'engineering', prec: PREC.rect + c.rooms.length, doors: [{ any: halls }] });
  });
  leftovers(c, 'engineering', lay.back, halls, () => ({ role: 'plant', mods: [], w: 3, h: 3 }));
  return true;
}

/** Gun deck: gun bays behind a short corridor of their own, doored to the public side. */
export function bayStrategy(c: Ctx2, tiles: number[], facilities: Facility[]): boolean {
  const g = c.g;
  const lay = layoutRects(g, tiles, facilities.map((f) => [f.spec.w, f.spec.h]));
  if (!lay) return false;
  solid(c, lay.rings);
  const hall = addRoom(c, { tiles: [...lay.aisle, ...lay.paths], spec: hallSpec(), dept: 'defence', prec: PREC.inner + c.rooms.length, doors: ['public'] });
  lay.order.forEach((k, j) => {
    addRoom(c, { tiles: rectParts(g, lay.rects[j] as TileRect).inner, spec: { ...(facilities[k] as Facility).spec }, dept: 'defence', prec: PREC.rect + c.rooms.length, doors: [hall] });
  });
  leftovers(c, 'defence', lay.back, [hall], () => ({ role: 'cargo', mods: ['module.storage_rack', 'module.storage_rack'], w: 3, h: 3 }));
  return true;
}

/** Hold sizes for a parcel: the largest that fit in turn (six deep down to four, up to 18 long) until the crates have room. */
function holdSizes(g: Grid, back: readonly number[], crates: number): [number, number][] {
  const free = new Set(back);
  const out: [number, number][] = [];
  for (let k = 0; k < 4 && out.reduce((t, [w, h]) => t + w * h, 0) < crates * 3.5; k++) {
    let got: TileRect | null = null;
    for (const h of [6, 5, 4]) {
      for (let w = 18; w >= 5 && !got; w--) got = placeRect(g, free, w, h, () => 0);
      if (got) break;
    }
    if (!got) break;
    out.push([got.w - 2, got.h - 2]);
    for (const i of [...rectParts(g, got).inner, ...rectParts(g, got).ring]) free.delete(i);
  }
  return out;
}

export function warehouseStrategy(c: Ctx2, tiles: number[], facilities: Facility[]): boolean {
  const g = c.g;
  const crates = facilities.flatMap((f) => f.spec.mods);
  const { back } = split(g, tiles);
  const sizes = holdSizes(g, back, crates.length);
  let lay: RectLayout | null = null;
  while (sizes.length > 0 && !(lay = layoutRects(g, tiles, sizes))) sizes.pop();
  if (!lay) return false;
  solid(c, lay.rings);
  // The aisle joins the harbour hall where the two meet; else it is the warehouse's own hall, doored to the corridor.
  const harbourHall = c.halls.get('harbour');
  const corridor = [...lay.aisle, ...lay.paths];
  const joins = harbourHall !== undefined && lay.aisle.some((i) => g.nb(i).some((j) => g.kind[j] === K.Room && g.id[j] === harbourHall));
  let hall: number;
  if (joins) {
    hall = harbourHall as number;
    for (const i of corridor) g.set(i, K.Room, hall);
    (c.rooms[hall] as { tiles: number[] }).tiles.push(...corridor);
  } else hall = addRoom(c, { tiles: corridor, spec: hallSpec(), dept: 'freight', prec: PREC.inner + c.rooms.length, doors: ['public'] });
  const area = lay.order.map((k) => (sizes[k] as [number, number])[0] * (sizes[k] as [number, number])[1]);
  const total = area.reduce((t, a) => t + a, 0);
  let given = 0;
  const base = facilities[0]?.spec;
  const rects = lay.rects;
  rects.forEach((r, j) => {
    const n = j === rects.length - 1 ? crates.length - given : Math.round((crates.length * (area[j] as number)) / total);
    const mods = crates.slice(given, given + n);
    given += n;
    addRoom(c, { tiles: rectParts(g, r).inner, spec: { role: 'cargo', mods, w: r.w - 2, h: r.h - 2, stock: true, warehouse: true, ...(base?.items ? { items: base.items } : {}) }, dept: 'freight', prec: PREC.rect + c.rooms.length, doors: [hall] });
  });
  leftovers(c, 'freight', lay.back, [hall], () => ({ role: 'cargo', mods: ['module.storage_rack', 'module.storage_rack'], w: 3, h: 3 }));
  return true;
}
