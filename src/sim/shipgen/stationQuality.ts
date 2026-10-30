import type { RoomRole } from './types';

/**
 * Layout quality above the room (dev metric): whether rooms sit by the neighbours their use asks for, the way building
 * layout generators place rooms by an adjacency table (Merrell et al. 2010's room-adjacency Bayes net; Lopes et al.
 * 2010's constrained growth from adjacency rules; Shadows of Doubt's public-to-private gradient).
 *
 * - adjacency: for each pair of roles in ADJACENCY present on the layout, the share of rooms of the first whose nearest
 *   room of the second is as the table wants it: within NEAR door steps for a "near" pair, NEAR + 1 or more (and no
 *   shared wall) for an "apart" pair. `adjacency` is the mean over the pairs present (0..1).
 * - clustering: districts. Of the room-to-room contacts (a shared wall or a door, corridors aside), the share joining two
 *   rooms of the same DISTRICT, over the share a random arrangement of the same rooms would give (1 = random, higher =
 *   rooms of a kind gather).
 *
 * Door steps count the rooms walked into, corridors included (a room off the same corridor is two steps).
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

const NEAR = 2;

export interface StationQuality { adjacency: number; pairs: Record<string, number>; clustering: number; contacts: number }

/** Quality of a layout's room arrangement: rows (as in a ShipTemplate), the room of each tile and each room's role. */
export function stationQuality(rows: readonly string[], roomOf: Int16Array, roles: readonly RoomRole[]): StationQuality {
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const cell = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const roomAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H || cell(x, y) !== '_' ? -1 : roomOf[y * W + x] ?? -1);
  const door = new Map<number, Set<number>>();
  const wall = new Map<number, Set<number>>();
  const link = (m: Map<number, Set<number>>, a: number, b: number): void => {
    if (a < 0 || b < 0 || a === b) return;
    (m.get(a) ?? m.set(a, new Set()).get(a) as Set<number>).add(b);
    (m.get(b) ?? m.set(b, new Set()).get(b) as Set<number>).add(a);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cell(x, y);
    if (c === '_') { link(door, roomAt(x, y), roomAt(x + 1, y)); link(door, roomAt(x, y), roomAt(x, y + 1)); continue; } // an archway
    if (c !== '#' && c !== 'D') continue;
    for (const [a, b] of [[roomAt(x - 1, y), roomAt(x + 1, y)], [roomAt(x, y - 1), roomAt(x, y + 1)]] as const) link(c === 'D' ? door : wall, a, b);
  }
  const present = new Set<number>();
  for (let i = 0; i < roomOf.length; i++) if ((roomOf[i] ?? -1) >= 0 && cell(i % W, Math.floor(i / W)) === '_') present.add(roomOf[i] as number);
  const rooms = [...present];
  const steps = (from: number): Map<number, number> => {
    const d = new Map<number, number>([[from, 0]]);
    const q = [from];
    for (let h = 0; h < q.length; h++) for (const n of door.get(q[h] as number) ?? []) if (!d.has(n)) { d.set(n, (d.get(q[h] as number) as number) + 1); q.push(n); }
    return d;
  };
  const pairs: Record<string, number> = {};
  for (const [a, b, want] of ADJACENCY) {
    const as = rooms.filter((r) => roles[r] === a), bs = rooms.filter((r) => roles[r] === b);
    if (as.length === 0 || bs.length === 0) continue;
    let ok = 0;
    for (const r of as) {
      const d = steps(r);
      const near = Math.min(...bs.map((o) => d.get(o) ?? Infinity));
      const touching = bs.some((o) => wall.get(r)?.has(o) || door.get(r)?.has(o));
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
  for (const r of inD) for (const o of new Set([...(wall.get(r) ?? []), ...(door.get(r) ?? [])])) {
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
