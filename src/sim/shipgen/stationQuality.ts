import type { RoomRole } from './types';

/**
 * Layout quality above the room (dev metric): whether rooms sit by the neighbours their use asks for, the way building
 * layout generators place rooms by an adjacency table (Merrell et al. 2010's room-adjacency Bayes net; Lopes et al.
 * 2010's constrained growth from adjacency rules; Shadows of Doubt's public-to-private gradient).
 *
 * - adjacency: for each pair of roles in ADJACENCY present on the layout, the share of rooms of the first whose nearest
 *   room of the second is as the table wants it: a walk of at most NEAR tiles (out of the room, along corridors, into
 *   the other) for a "near" pair, more than NEAR and no shared wall for an "apart" pair. `adjacency` is the mean over
 *   the pairs present (0..1). Walking distance, not door steps: on a ring every room doors onto one corridor.
 * - clustering: districts. Of the room-to-room contacts (a shared wall or a door, corridors aside), the share joining two
 *   rooms of the same DISTRICT, over the share a random arrangement of the same rooms would give (1 = random, higher =
 *   rooms of a kind gather).
 */

/** Role pairs: +1 want to be near, -1 want to be apart. */
export const ADJACENCY: readonly (readonly [RoomRole, RoomRole, 1 | -1])[] = [
  ['quarters', 'support', 1], ['quarters', 'garden', 1], ['quarters', 'reactor', -1], ['quarters', 'industry', -1],
  ['quarters', 'weapons', -1], ['quarters', 'engine', -1], ['quarters', 'dock', -1],
  ['dock', 'cargo', 1], ['dock', 'armoury', 1], ['dock', 'plaza', 1],
  ['farm', 'support', 1], ['industry', 'cargo', 1], ['industry', 'dock', 1],
  ['reactor', 'shields', 1], ['reactor', 'engine', 1], ['bridge', 'core', 1], ['armoury', 'weapons', 1],
  ['plaza', 'support', 1], ['hangar', 'cargo', 1],
];

/** Districts: rooms of one gather together. Corridors and docks belong to none. */
export const DISTRICT: Readonly<Partial<Record<RoomRole, string>>> = {
  quarters: 'living', support: 'living', garden: 'living',
  cargo: 'trade', plaza: 'trade', hangar: 'trade',
  industry: 'works', farm: 'works',
  reactor: 'systems', engine: 'systems', shields: 'systems', core: 'systems', bridge: 'systems',
  weapons: 'defence', armoury: 'defence', drill: 'defence',
};

/** Tiles of walk that still count as near (about a room's length plus the corridor between). */
const NEAR = 12;

export interface StationQuality { adjacency: number; pairs: Record<string, number>; clustering: number; contacts: number }

/**
 * The rooms of a layout as a graph: which rooms touch (a shared wall, or a door or archway between them) and the walk
 * between every two (tiles from one's floor to the other's). Fixed by the geometry: roles can be swapped over it and
 * re-scored cheaply (`scoreRoles`).
 */
export interface RoomGraph { rooms: number[]; touch: Map<number, Set<number>>; door: Map<number, Set<number>>; walk: Map<number, Map<number, number>> }

export function roomGraph(rows: readonly string[], roomOf: Int16Array): RoomGraph {
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const cell = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const roomAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H || cell(x, y) !== '_' ? -1 : roomOf[y * W + x] ?? -1);
  const door = new Map<number, Set<number>>();
  const touch = new Map<number, Set<number>>();
  const link = (m: Map<number, Set<number>>, a: number, b: number): void => {
    if (a < 0 || b < 0 || a === b) return;
    (m.get(a) ?? m.set(a, new Set()).get(a) as Set<number>).add(b);
    (m.get(b) ?? m.set(b, new Set()).get(b) as Set<number>).add(a);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cell(x, y);
    const pairs = c === '_' ? [[roomAt(x, y), roomAt(x + 1, y)], [roomAt(x, y), roomAt(x, y + 1)]] // an archway
      : c === '#' || c === 'D' ? [[roomAt(x - 1, y), roomAt(x + 1, y)], [roomAt(x, y - 1), roomAt(x, y + 1)]] : [];
    for (const [a, b] of pairs as [number, number][]) {
      link(touch, a, b);
      if (c !== '#') link(door, a, b);
    }
  }
  const tilesOf = new Map<number, number[]>();
  for (let i = 0; i < roomOf.length; i++) {
    const r = roomOf[i] ?? -1;
    if (r >= 0 && cell(i % W, Math.floor(i / W)) === '_') (tilesOf.get(r) ?? tilesOf.set(r, []).get(r) as number[]).push(i);
  }
  const rooms = [...tilesOf.keys()].sort((a, b) => a - b);
  const walk = new Map<number, Map<number, number>>();
  const d = new Int32Array(W * H);
  for (const r of rooms) {
    d.fill(-1);
    const q = [...(tilesOf.get(r) as number[])];
    for (const i of q) d[i] = 0;
    const best = new Map<number, number>();
    for (let h = 0; h < q.length; h++) {
      const i = q[h] as number;
      const o = roomOf[i] ?? -1;
      if (o >= 0 && o !== r && cell(i % W, Math.floor(i / W)) === '_' && !best.has(o)) best.set(o, d[i] as number);
      const x = i % W, y = (i - x) / W;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        const c = cell(nx, ny);
        const j = ny * W + nx;
        if ((c === '_' || c === 'D') && d[j] === -1) { d[j] = (d[i] as number) + 1; q.push(j); }
      }
    }
    walk.set(r, best);
  }
  return { rooms, touch, door, walk };
}

/** Quality of a layout's room arrangement: rows (as in a ShipTemplate), the room of each tile and each room's role. */
export function stationQuality(rows: readonly string[], roomOf: Int16Array, roles: readonly RoomRole[]): StationQuality {
  return scoreRoles(roomGraph(rows, roomOf), roles);
}

/** The quality of `roles` over a room graph. */
export function scoreRoles(g: RoomGraph, roles: readonly RoomRole[]): StationQuality {
  const { rooms, touch, walk } = g;
  const pairs: Record<string, number> = {};
  for (const [a, b, want] of ADJACENCY) {
    const as = rooms.filter((r) => roles[r] === a), bs = rooms.filter((r) => roles[r] === b);
    if (as.length === 0 || bs.length === 0) continue;
    let ok = 0;
    for (const r of as) {
      const w = walk.get(r);
      const near = Math.min(...bs.map((o) => w?.get(o) ?? Infinity));
      const touching = bs.some((o) => touch.get(r)?.has(o));
      if (want > 0 ? near <= NEAR : near > NEAR && !touching) ok++;
    }
    pairs[`${a}${want > 0 ? '~' : '/'}${b}`] = ok / as.length;
  }
  const vals = Object.values(pairs);
  // Districts: contacts between rooms that have one.
  const inD = rooms.filter((r) => DISTRICT[roles[r] as RoomRole]);
  const share = new Map<string, number>();
  for (const r of inD) share.set(DISTRICT[roles[r] as RoomRole] as string, (share.get(DISTRICT[roles[r] as RoomRole] as string) ?? 0) + 1 / inD.length);
  const expected = [...share.values()].reduce((s, p) => s + p * p, 0);
  let contacts = 0, same = 0;
  for (const r of inD) for (const o of touch.get(r) ?? []) {
    if (o <= r || !DISTRICT[roles[o] as RoomRole]) continue;
    contacts++;
    if (DISTRICT[roles[o] as RoomRole] === DISTRICT[roles[r] as RoomRole]) same++;
  }
  return {
    adjacency: vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 1,
    pairs,
    clustering: contacts > 0 && expected > 0 ? same / contacts / expected : 1,
    contacts,
  };
}
