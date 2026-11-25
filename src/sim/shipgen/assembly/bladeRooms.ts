import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';

/**
 * A raider's blade rooms (PROTOTYPE, #581): the blade floor cut into rooms, each the largest rectangle left (a wall between
 * two), on the upper side and mirrored below; what no room takes is crawlway. Each gets a door to what it joins. The
 * ship's guns stand in the blade rooms nearest the body that hold them, and its airlocks move out of the body into the
 * smallest rooms on a blade's outer edge (the body's dock rooms left as floor of the corridor they end); the rest are
 * unfurnished.
 */

/** The grid the blades were drawn on: cells, rooms, the blade floor still free, the body's tiles, its size and axis row. */
export interface BladeGrid { cells: string[]; roomOf: Int16Array; floor: Uint8Array; body: Uint8Array; W: number; H: number; A: number }

/** A blade room's longest side in floor tiles, and its least. */
const MAX_SIDE = 9, MIN_SIDE = 3;

interface Cut { top: number; bottom: number; x: number; y: number; w: number; h: number }

export function bladeRooms(g: BladeGrid, roles0: readonly RoomRole[], specs0: readonly (RoomSpec | undefined)[], guns: readonly RoomSpec[]): { roles: RoomRole[]; specs: (RoomSpec | undefined)[] } {
  const { cells, roomOf, floor, body, W, H, A } = g, at = (x: number, y: number): number => y * W + x;
  const roles = [...roles0], specs: (RoomSpec | undefined)[] = [...specs0];
  const mirror = (y: number): number => 2 * A - y;
  const free = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < A && !!floor[at(x, y)];
  const setFloor = (x: number, y: number, r: number): void => { for (const yy of [y, mirror(y)]) { const i = at(x, yy); cells[i] = '_'; roomOf[i] = r; floor[i] = 0; } };
  const setWall = (x: number, y: number): void => { for (const yy of [y, mirror(y)]) { const i = at(x, yy); cells[i] = '#'; floor[i] = 0; } };
  const cuts: Cut[] = [];
  for (;;) {
    const r = largestRect(free, W, A);
    if (!r) break;
    const [rx, ry, rw, rh] = r, top = roles.length, bottom = top + 1;
    roles.push('cargo', 'cargo');
    cuts.push({ top, bottom, x: rx, y: ry, w: rw, h: rh });
    for (let y = ry - 1; y <= ry + rh; y++) for (let x = rx - 1; x <= rx + rw; x++) {
      const inR = x >= rx && x < rx + rw && y >= ry && y < ry + rh;
      if (inR) { setFloor(x, y, top); roomOf[at(x, mirror(y))] = bottom; } else if (free(x, y)) setWall(x, y);
    }
  }
  // What is left is crawlway, a hall each piece.
  for (let y = 0; y < A; y++) for (let x = 0; x < W; x++) {
    if (!free(x, y)) continue;
    const top = roles.length, bottom = top + 1, stack: [number, number][] = [[x, y]];
    roles.push('hall', 'hall');
    setFloor(x, y, top); roomOf[at(x, mirror(y))] = bottom;
    while (stack.length > 0) {
      const [cx, cy] = stack.pop() as [number, number];
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) if (free(nx, ny)) { setFloor(nx, ny, top); roomOf[at(nx, mirror(ny))] = bottom; stack.push([nx, ny]); }
    }
  }
  connect(cells, roomOf, roles, roles0.length, W, H, body);
  // (A cut kept: its floor still there.)
  const live = cuts.filter((c) => roomOf[at(c.x, c.y)] === c.top && cells[at(c.x, c.y)] === '_');
  // How far a cut stands from the body (its nearest floor tile to the nearest body tile, by rows and columns).
  const bodyCols = [...body.keys()].filter((i) => body[i]);
  const gap = (c: Cut): number => Math.min(...bodyCols.map((i) => { const bx = i % W, by = (i - bx) / W; return Math.max(0, c.x - bx, bx - (c.x + c.w - 1)) + Math.max(0, c.y - by, by - (c.y + c.h - 1)); }));
  const taken = new Set<Cut>();
  // The guns, two to a pair of cuts (top and bottom), the nearest the body that hold them, the larger first between equals.
  const holds = (c: Cut, sp: RoomSpec): boolean => (c.w >= sp.w && c.h >= sp.h) || (c.w >= sp.h && c.h >= sp.w);
  const near = [...live].sort((a, b) => gap(a) - gap(b) || b.w * b.h - a.w * a.h);
  for (let i = 0; i < guns.length; i += 2) {
    const pair = guns.slice(i, i + 2), c = near.find((q) => !taken.has(q) && pair.every((sp) => holds(q, sp)));
    if (!c) break;
    taken.add(c);
    pair.forEach((sp, k) => { const r = k === 0 ? c.top : c.bottom; roles[r] = 'weapons'; specs[r] = sp; });
  }
  // The airlocks: each body dock's spec to the smallest free cut on a blade's outer edge, its side of the axis; the body's
  // dock becomes floor of the corridor it ends.
  const outer = (c: Cut): boolean => {
    for (let y = c.y - 2; y <= c.y + c.h + 1; y++) for (let x = c.x - 2; x <= c.x + c.w + 1; x++) if (x >= 0 && y >= 0 && x < W && y < H && cells[at(x, y)] === '.') return true;
    return false;
  };
  const edge = live.filter((c) => !taken.has(c) && outer(c)).sort((a, b) => a.w * a.h - b.w * b.h);
  const docks = roles0.flatMap((r, i) => (r === 'dock' ? [i] : []));
  const dockAbove = (d: number): boolean => { for (let i = 0; i < W * H; i++) if (roomOf[i] === d) return (i - (i % W)) / W < A; return true; };
  const upper = docks.filter(dockAbove), lower = docks.filter((d) => !dockAbove(d));
  for (let i = 0; i < Math.max(upper.length, lower.length); i++) {
    const c = edge[i];
    if (!c) break;
    for (const [d, r] of [[upper[i], c.top], [lower[i], c.bottom]] as const) {
      if (d === undefined) continue;
      roles[r] = 'dock'; specs[r] = specs0[d]; roles[d] = 'hall'; specs[d] = undefined;
    }
  }
  return { roles, specs };
}

/** The largest rectangle of free tiles, each side `MIN_SIDE` to `MAX_SIDE` (counted capped): x, y, w, h. */
function largestRect(free: (x: number, y: number) => boolean, W: number, H: number): [number, number, number, number] | null {
  const run = new Int16Array(W * H);
  for (let y = 0; y < H; y++) for (let x = W - 1; x >= 0; x--) run[y * W + x] = free(x, y) ? 1 + (x + 1 < W ? (run[y * W + x + 1] as number) : 0) : 0;
  let best: [number, number, number, number] | null = null, area = 0;
  for (let y0 = 0; y0 < H; y0++) for (let x0 = 0; x0 < W; x0++) {
    let w = MAX_SIDE;
    for (let y1 = y0; y1 < Math.min(H, y0 + MAX_SIDE); y1++) {
      w = Math.min(w, run[y1 * W + x0] as number);
      const h = y1 - y0 + 1;
      if (w < MIN_SIDE) break;
      if (h >= MIN_SIDE && w * h > area) { area = w * h; best = [x0, y0, w, h]; }
    }
  }
  return best;
}

/**
 * Doors: each blade room and crawlway joined through a straight wall tile to one already reached (the body's rooms from
 * the start), halls first; where only a wall two thick parts them (a blade room's wall against the body's), through both,
 * the inner tile its floor; else by the shortest way through the blades' inner walls, cut as its floor. What none reaches
 * goes, its hull with it.
 */
function connect(cells: string[], roomOf: Int16Array, roles: RoomRole[], first: number, W: number, H: number, body: Uint8Array): void {
  const reached = new Set<number>(Array.from({ length: first }, (_, i) => i));
  const fl = (i: number): number => (cells[i] === '_' ? (roomOf[i] as number) : -1);
  const wall = (...is: number[]): boolean => is.every((i) => cells[i] === '#');
  // Joins `to` from `from` across the wall tiles `ws` (the door first), the rest `to`'s floor.
  const join = (mode: 'halls' | 'any' | 'thick', i: number, s: number, p: number): boolean => {
    const thick = mode === 'thick', far = thick ? i + 2 * s : i + s, ws = thick ? [i, i + s] : [i];
    if (!wall(...ws, ...ws.map((w) => w - p), ...ws.map((w) => w + p))) return false;
    const ra = fl(i - s), rb = fl(far);
    if (ra < 0 || rb < 0 || ra === rb || reached.has(ra) === reached.has(rb)) return false;
    const [from, to] = reached.has(ra) ? [ra, rb] : [rb, ra];
    if (mode === 'halls' && roles[from] !== 'hall') return false;
    const door = reached.has(ra) ? ws : [...ws].reverse();
    cells[door[0] as number] = 'D';
    for (const w of door.slice(1)) { cells[w] = '_'; roomOf[w] = to; }
    reached.add(to);
    return true;
  };
  for (let progress = true; progress;) {
    progress = false;
    for (const mode of ['halls', 'any', 'thick'] as const) {
      for (let y = 2; y < H - 2 && !progress; y++) for (let x = 2; x < W - 2 && !progress; x++) {
        const i = y * W + x;
        progress = join(mode, i, 1, W) || join(mode, i, W, 1);
      }
      if (progress) break;
    }
  }
  for (let r = first; r < roles.length; r++) if (!reached.has(r) && carve(r)) reached.add(r);
  for (let i = 0; i < W * H; i++) if (cells[i] === '_' && !reached.has(roomOf[i] as number)) { cells[i] = '#'; roomOf[i] = -1; }
  // Blade wall with no floor beside it (8 ways) goes to space: what was walled up, and any wall more than a tile thick.
  const open = (i: number): boolean => cells[i] === '_' || cells[i] === 'D';
  const bare = [...cells.keys()].filter((i) => cells[i] === '#' && !body[i] && ![i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1].some(open));
  for (const i of bare) cells[i] = '.';

  /** A way cut from room `r` through inner wall (none on the hull's edge, none of the body's but the door) to a reached room. */
  function carve(r: number): boolean {
    const edge = (i: number): boolean => [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1].some((j) => (cells[j] ?? '.') === '.');
    const prev = new Int32Array(W * H).fill(-2), queue: number[] = [];
    for (let i = 0; i < W * H; i++) if (cells[i] === '_' && roomOf[i] === r) { prev[i] = -1; queue.push(i); }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q] as number;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || prev[j] !== -2) continue;
        const f = fl(j);
        if (f >= 0 && f !== r && reached.has(f) && cells[i] === '#') {
          cells[i] = 'D';
          for (let k = prev[i] as number; k >= 0 && cells[k] === '#'; k = prev[k] as number) { cells[k] = '_'; roomOf[k] = r; }
          return true;
        }
        if (cells[j] !== '#' || edge(j) || (body[j] && cells[i] === '#')) continue;
        if (body[j] && cells[i] !== '_') continue;
        prev[j] = i; queue.push(j);
      }
    }
    return false;
  }
}
