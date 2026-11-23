import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';
import { RegionGrid, SOLID } from './regions';

/**
 * A drawn hull (the old arrangers' canvas: every room in its own wall box, so walls are doubled where rooms stand side
 * by side, and plating fills the gaps) redrawn on the region grid (SHIPGEN_V4 step 2). Each room owns its floor and the
 * wall ring round it that it shares with no other room; a wall tile already between two rooms stays wall. Plating that
 * touches no floor goes to the room it lies against (the nearest that may grow), so a slab becomes floor rather than a
 * block of wall. The grid's one wall rule then settles every join, one tile thick. Doors are the grid's, onto the rooms
 * each room had a door to.
 */

export interface Drawn {
  rows: readonly string[];
  /** The room label of each floor tile (-1: none). */
  labels: Int16Array;
  width: number;
  height: number;
  roles: readonly RoomRole[];
  specs: readonly (RoomSpec | undefined)[];
  /** Twice the mirror axis row in the drawing's rows (a mirrored hull), so mirrored joins are settled alike. */
  axis2?: number;
  /** Rooms grow over plating that touches no floor; otherwise the drawn plating stays, solid hull. */
  grow?: boolean;
  /** Whether a room may grow over plating beside it (not a sealed pod, an engine room, a dock, a hangar). */
  canGrow: (label: number) => boolean;
}

export interface Redrawn { rows: string[]; roomOf: Int16Array; width: number; height: number; roles: RoomRole[]; specs: (RoomSpec | undefined)[] }

interface DrawnDoor { x: number; y: number; a: number; b: number }

/**
 * The drawing's doors on the redrawn walls: each where it was drawn when that tile is still a wall between the same two
 * rooms, else in the middle of the wall they share. One door for each pair of rooms (a drawn double door stays double).
 */
function placeDoors(g: RegionGrid, cell: string[], doors: readonly DrawnDoor[], region: ReadonlyMap<number, number>, W: number, H: number): void {
  const { size, half } = g;
  const k = (x: number, y: number): number => (y + half) * size + x + half;
  const floorOf = (x: number, y: number): number => (cell[k(x, y)] === '_' ? g.at(x, y) : -3);
  // Wall along a run (a door beside it counts: a drawn double door stays double).
  const w = (x: number, y: number): boolean => cell[k(x, y)] === '#' || cell[k(x, y)] === 'D';
  const joins = (x: number, y: number, a: number, b: number): boolean => cell[k(x, y)] === '#' && (
    (w(x - 1, y) && w(x + 1, y) && ((floorOf(x, y - 1) === a && floorOf(x, y + 1) === b) || (floorOf(x, y - 1) === b && floorOf(x, y + 1) === a)))
    || (w(x, y - 1) && w(x, y + 1) && ((floorOf(x - 1, y) === a && floorOf(x + 1, y) === b) || (floorOf(x - 1, y) === b && floorOf(x + 1, y) === a))));
  const done = new Set<string>();
  for (const dr of doors) {
    const a = region.get(dr.a), b = region.get(dr.b);
    if (a === undefined || b === undefined) continue;
    if (joins(dr.x, dr.y, a, b)) { cell[k(dr.x, dr.y)] = 'D'; done.add(`${dr.x},${dr.y}`); continue; }
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (done.has(key)) continue;
    const cands: [number, number][] = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (joins(x, y, a, b)) cands.push([x, y]);
    // Already joined by a door kept where it was drawn: nothing to move.
    const already = doors.some((o) => o !== dr && done.has(`${o.x},${o.y}`) && ((region.get(o.a) === a && region.get(o.b) === b) || (region.get(o.a) === b && region.get(o.b) === a)));
    if (already || cands.length === 0) continue;
    const [x, y] = cands[Math.floor(cands.length / 2)] as [number, number];
    cell[k(x, y)] = 'D';
    done.add(key);
  }
}

/** Floor tiles of a room (not a hall) outside its largest connected piece. */
function cutOff(g: RegionGrid, cell: string[], W: number, H: number): [number, number][] {
  const { size, half } = g;
  const k = (x: number, y: number): number => (y + half) * size + x + half;
  const seen = new Set<number>();
  const pieces = new Map<number, [number, number][][]>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = g.at(x, y);
    if (id < 0 || cell[k(x, y)] !== '_' || seen.has(k(x, y)) || g.regions[id]?.hall) continue;
    const piece: [number, number][] = [];
    const stack: [number, number][] = [[x, y]];
    seen.add(k(x, y));
    while (stack.length > 0) {
      const [cx, cy] = stack.pop() as [number, number];
      piece.push([cx, cy]);
      for (const [dx, dy] of N4) {
        const nx = cx + dx, ny = cy + dy;
        if (seen.has(k(nx, ny)) || g.at(nx, ny) !== id || cell[k(nx, ny)] !== '_') continue;
        seen.add(k(nx, ny));
        stack.push([nx, ny]);
      }
    }
    pieces.set(id, [...(pieces.get(id) ?? []), piece]);
  }
  const out: [number, number][] = [];
  for (const ps of pieces.values()) if (ps.length > 1) out.push(...[...ps].sort((a, b) => b.length - a.length).slice(1).flat());
  return out;
}

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;

export function regrid(d: Drawn): Redrawn {
  const { rows, labels, width: W, height: H } = d;
  const cell = (x: number, y: number): string => (x < 0 || y < 0 || x >= W || y >= H ? '.' : (rows[y]?.[x] ?? '.'));
  const lab = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H || cell(x, y) !== '_' ? -1 : (labels[y * W + x] as number));
  const half = Math.max(W, H) + 2;
  const g = new RegionGrid(half);
  // Regions, one a label that has floor, in label order.
  const region = new Map<number, number>();
  const used = new Set<number>();
  for (let k = 0; k < W * H; k++) if (rows[Math.floor(k / W)]?.[k % W] === '_' && (labels[k] as number) >= 0) used.add(labels[k] as number);
  // Doors in the drawing: each room's doors and the rooms they open onto.
  const drawnDoors: DrawnDoor[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (cell(x, y) !== 'D') continue;
    for (const [a, b] of [[lab(x, y - 1), lab(x, y + 1)], [lab(x - 1, y), lab(x + 1, y)]] as const) {
      if (a >= 0 && b >= 0 && a !== b && !(d.roles[a] === 'hall' && d.roles[b] === 'hall')) drawnDoors.push({ x, y, a, b });
    }
  }
  // Rank: which room keeps its floor where two meet. By place, bow to stern, then out from the axis, so the two halves
  // of a mirrored hull settle their joins alike (creation order would not).
  const ext = new Map<number, [number, number, number, number]>();
  for (let k = 0; k < W * H; k++) {
    const l = labels[k] as number, x = k % W, y = Math.floor(k / W);
    if (!used.has(l) || rows[y]?.[x] !== '_') continue;
    const e = ext.get(l) ?? [x, y, x, y];
    ext.set(l, [Math.min(e[0], x), Math.min(e[1], y), Math.max(e[2], x), Math.max(e[3], y)]);
  }
  const rankOf = (l: number): number => {
    const [x0, y0, x1, y1] = ext.get(l) as [number, number, number, number];
    // A mirrored pair that meets across the axis: the north one keeps the wall's floor.
    return ((x0 + x1) * 4096 + (d.axis2 === undefined ? y0 + y1 : Math.abs(y0 + y1 - d.axis2))) * 2 + (d.axis2 !== undefined && y0 + y1 < d.axis2 ? 1 : 0);
  };
  // Every hall is one region: the corridors are open to each other.
  let hall = -1;
  for (const l of [...used].sort((a, b) => a - b)) {
    const role = d.roles[l] as RoomRole;
    if (role === 'hall') { region.set(l, hall >= 0 ? hall : (hall = g.hall('hall'))); continue; }
    region.set(l, g.room(role, { ...(d.specs[l] ? { spec: d.specs[l] } : {}), doors: 0, rank: rankOf(l) }));
  }
  const own = new Int32Array(W * H).fill(-1); // -1 space, -2 solid, else region
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const l = lab(x, y);
    if (l >= 0 && region.has(l)) own[y * W + x] = region.get(l) as number;
  }
  // A door between two halls is a way through: the first hall's floor.
  const isHall = (l: number): boolean => l >= 0 && d.roles[l] === 'hall' && region.has(l);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (cell(x, y) !== 'D') continue;
    for (const [a, b] of [[lab(x, y - 1), lab(x, y + 1)], [lab(x - 1, y), lab(x + 1, y)]] as const) if (isHall(a) && isHall(b)) own[y * W + x] = region.get(a) as number;
  }
  // Rings: a wall tile beside one room's floor is that room's; beside two rooms' it stays wall.
  const isWall = (c: string): boolean => c === '#' || c === 'D';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isWall(cell(x, y)) || own[y * W + x] !== -1) continue;
    const near = new Set<number>();
    for (const [dx, dy] of N8) { const l = lab(x + dx, y + dy); if (l >= 0 && region.has(l)) near.add(region.get(l) as number); }
    if (near.size === 1) own[y * W + x] = [...near][0] as number;
    else if (near.size > 1) own[y * W + x] = SOLID;
  }
  // Plating touching no floor: the nearest ring's room takes it, layer by layer, where that room may grow.
  const grows = new Set(d.grow ? [...region].filter(([l]) => d.roles[l] !== 'hall' && d.canGrow(l)).map(([, id]) => id) : []);
  for (let changed = true; changed;) {
    changed = false;
    const next = own.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (own[k] !== -1 || cell(x, y) !== '#') continue;
      // The highest-ranked room beside it takes it; two of one rank (a mirrored pair) leave it.
      let best = -1, tie = false;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const o = own[ny * W + nx] as number;
        if (o < 0 || !grows.has(o) || o === best) continue;
        const r = (g.regions[o] as { rank: number }).rank, rb = best >= 0 ? (g.regions[best] as { rank: number }).rank : -Infinity;
        if (r > rb) { best = o; tie = false; } else if (r === rb) tie = true;
      }
      if (best >= 0 && !tie) { next[k] = best; changed = true; }
    }
    own.set(next);
  }
  // Plating no room grew over: wall where it touches a room or hall (its ring included), else it goes.
  const built = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && (own[y * W + x] as number) >= 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (own[k] === -1 && cell(x, y) === '#' && N8.some(([dx, dy]) => built(x + dx, y + dy))) own[k] = SOLID;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = own[y * W + x] as number; if (o !== -1) g.set(x, y, o); }
  // Floor a room grew that the walls cut off from the rest of it (a corner of plating): plating again.
  let cellOut = g.compile();
  for (let pass = 0; pass < 3; pass++) {
    const cut = cutOff(g, cellOut, W, H);
    if (cut.length === 0) break;
    for (const [x, y] of cut) g.set(x, y, SOLID);
    cellOut = g.compile();
  }
  placeDoors(g, cellOut, drawnDoors, region, W, H);
  const snap = g.snapshot(cellOut, [1, 1, W - 1, H - 1]); // the drawing's frame (the snapshot adds a tile all round)
  // The snapshot spans the drawing's frame: beams and anything else drawn outside the hull carry over.
  const out = snap.rows.map((r, y) => [...r].map((c, x) => (c === '.' && cell(x + snap.x0, y + snap.y0) === '=' ? '=' : c)).join(''));
  return { rows: out, roomOf: snap.roomOf, width: snap.width, height: snap.height, roles: g.regions.map((r) => r.role), specs: g.regions.map((r) => r.spec) };
}
