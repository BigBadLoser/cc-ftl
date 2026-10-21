import type { RoomRole } from '../types';

/** Rooms at least this many floor tiles may keep a second door. */
const BIG_ROOM = 30;

/**
 * Close surplus doors: one per room by default, two for big rooms. A door stays when closing it would cut part of
 * the ship off (rooms crew pass through keep theirs). Doors onto halls are kept over doors between rooms, and wider
 * doors over narrow ones. Halls and docks keep every door. Deterministic, no rng: it reads the drawn layout only.
 */
export function pruneDoors(rows: string[], roomOf: Int16Array, w: number, roles: readonly RoomRole[]): string[] {
  const h = rows.length;
  const cells = rows.flatMap((r) => Array.from({ length: w }, (_, x) => r[x] ?? '.'));
  const at = (i: number): string => cells[i] as string;
  const nb = (i: number): number[] => {
    const x = i % w;
    const out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < w - 1) out.push(i + 1);
    if (i >= w) out.push(i - w);
    if (i < (h - 1) * w) out.push(i + w);
    return out;
  };
  // Door groups: runs of touching door tiles, with the rooms they open onto.
  const group = new Int32Array(cells.length).fill(-1);
  const groups: { tiles: number[]; rooms: Set<number> }[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (at(i) !== 'D' || group[i] !== -1) continue;
    const g = { tiles: [] as number[], rooms: new Set<number>() };
    const stack = [i];
    group[i] = groups.length;
    while (stack.length > 0) {
      const j = stack.pop() as number;
      g.tiles.push(j);
      for (const n of nb(j)) {
        if (at(n) === 'D' && group[n] === -1) { group[n] = groups.length; stack.push(n); }
        else if (at(n) === '_' && (roomOf[n] as number) >= 0) g.rooms.add(roomOf[n] as number);
      }
    }
    groups.push(g);
  }
  const floorOf = new Map<number, number>();
  for (let i = 0; i < cells.length; i++) if (at(i) === '_') floorOf.set(roomOf[i] as number, (floorOf.get(roomOf[i] as number) ?? 0) + 1);
  const open = (i: number): boolean => at(i) === '_' || at(i) === 'D';
  const reach = (): number => {
    const start = cells.findIndex((c) => c === 'D');
    if (start < 0) return 0;
    const seen = new Uint8Array(cells.length);
    const stack = [start];
    seen[start] = 1;
    let n = 0;
    while (stack.length > 0) {
      const j = stack.pop() as number;
      n++;
      for (const k of nb(j)) if (!seen[k] && open(k)) { seen[k] = 1; stack.push(k); }
    }
    return n;
  };
  const isHall = (r: number): boolean => roles[r] === 'hall';
  const keepAll = (r: number): boolean => isHall(r) || roles[r] === 'dock';
  let reached = reach();
  for (let room = 0; room < roles.length; room++) {
    if (keepAll(room)) continue;
    const mine = groups.map((g, gi) => ({ g, gi })).filter(({ g }) => g.rooms.has(room) && g.tiles.every((t) => at(t) === 'D'));
    const big = (floorOf.get(room) ?? 0) >= BIG_ROOM;
    const allowed = big ? 2 : 1;
    // A small room's wide door narrows to its middle tile (the rest turns back into wall for modules to back onto).
    if (!big) {
      for (const { g } of mine) {
        if (g.tiles.length < 2) continue;
        const sorted = [...g.tiles].sort((a, b) => a - b);
        const mid = sorted[(sorted.length - 1) >> 1] as number;
        for (const t of sorted) if (t !== mid) cells[t] = '#';
        if (reach() + g.tiles.length - 1 < reached) { for (const t of sorted) cells[t] = 'D'; continue; }
        reached -= g.tiles.length - 1;
        g.tiles = [mid];
      }
    }
    if (mine.length <= allowed) continue;
    // Best first: onto a hall, then wider, then lower index (stable).
    const rank = ({ g }: { g: { tiles: number[]; rooms: Set<number> } }): number =>
      ([...g.rooms].some((r) => r !== room && isHall(r)) ? 100 : 0) + g.tiles.length;
    mine.sort((a, b) => rank(b) - rank(a) || a.gi - b.gi);
    let kept = 0;
    for (const { g } of mine) {
      if (kept < allowed) { kept++; continue; }
      // The other room must keep a door too.
      const others = [...g.rooms].filter((r) => r !== room);
      if (others.some((r) => !keepAll(r) && groups.filter((o) => o !== g && o.rooms.has(r) && o.tiles.every((t) => at(t) === 'D')).length === 0)) { kept++; continue; }
      for (const t of g.tiles) cells[t] = '#';
      const n = reach();
      if (n + g.tiles.length < reached) { for (const t of g.tiles) cells[t] = 'D'; kept++; continue; }
      reached = n;
    }
  }
  const out: string[] = [];
  for (let y = 0; y < h; y++) out.push(cells.slice(y * w, y * w + w).join('').slice(0, (rows[y] as string).length));
  return out;
}
