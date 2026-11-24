import type { Rng } from '../../rng';
import type { BladeKind, BladeSpec, RaiderNose } from '../outlineRecipe';
import type { RoomRole } from '../types';
import { bladeShape, inPoly, noseShape, type Poly } from './bladeShapes';

/**
 * Raider blades (PROTOTYPE, #581): hull added along the body's sides once its rooms are cut, as on the approved mock
 * sheet. The blades are drawn from the palette (bladeShapes.ts), placed at the body's sides and mirrored; the hull rules
 * hold by an opening (every part at least three wide, so a wall a tile thick round floor), and what the opening cuts off
 * the body goes. The blade floor is cut into rooms, each the largest rectangle left (a wall between two), unfurnished;
 * what no room takes is crawlway. Each gets a door to what it joins. Nothing stands over the body's rooms that open out:
 * an airlock keeps its hull face, the drives the space astern.
 */

export interface Bladed { rows: string[]; roomOf: Int16Array; width: number; height: number; roles: RoomRole[] }

/** Rooms near which no blade stands (an airlock opens out of the hull's side; the engines' face astern is kept apart). */
const OPEN_OUT: readonly RoomRole[] = ['dock'];
/** A blade room's longest side in floor tiles, and its least. */
const MAX_SIDE = 9, MIN_SIDE = 3;
/** Where along the body the blades root (a fraction of its length from the bow): fore, aft, horn. */
const ROOT = { fore: 0.4, aft: 0.62, horn: 0.52 };
/** The mock's medium body half-beam, at which a blade's scale is 1; the leading end's scale over it, and the other's. */
const MEDIUM = 13, LEAD = 1.15, TRAIL = 0.9;

/** The reach of the closing that fills a narrow gap between a blade and the body (two tiles). */
const CLOSE = 2;

const N8: readonly (readonly [number, number])[] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

export function addBlades(rng: Rng, spec: BladeSpec, s: { rows: string[]; roomOf: Int16Array; width: number; height: number }, axis: number, roles0: readonly RoomRole[]): Bladed {
  const lead = rng.pick(spec.lead as ('fore' | 'aft')[]), fore = rng.pick(spec.fore as (BladeKind | null)[]), aft = rng.pick(spec.aft as (BladeKind | null)[]);
  const horn = rng.chance(spec.horn), nose = spec.noses ? rng.pick(spec.noses as RaiderNose[]) : null;
  // The body: its columns, and its half-beam at each.
  const body0 = (x: number, y: number): boolean => (s.rows[y]?.[x] ?? '.') !== '.';
  const cols = Array.from({ length: s.width }, (_, x) => { let t = -1; for (let y = 0; y < s.height; y++) if (body0(x, y)) t = Math.max(t, Math.abs(y - axis)); return t; });
  const bx0 = cols.findIndex((t) => t >= 0), bx1 = cols.length - 1 - [...cols].reverse().findIndex((t) => t >= 0), len = bx1 - bx0 + 1;
  const k = (Math.max(...cols) + 1) / MEDIUM, [fk, ak] = lead === 'fore' ? [LEAD * k, TRAIL * k] : [TRAIL * k, LEAD * k];
  // The columns of the rooms that open out of the side.
  const shut = new Set<number>();
  s.roomOf.forEach((r, i) => { if (r >= 0 && OPEN_OUT.includes(roles0[r] as RoomRole)) shut.add(i % s.width); });
  // Each blade at its root (on the body's side there), pointing aft (+1) or fore (-1).
  const polys: Poly[] = [];
  const place = (kind: BladeKind | null, kk: number, at: number, dir: number): void => {
    if (!kind) return;
    // Its root slid along the side, nearest first, until where it meets the body (within two tiles of its side) is clear of
    // the airlocks by two tiles.
    const shape = bladeShape(kind, kk), x0 = Math.round(bx0 + at * len), [u0, u1] = footprint(shape);
    const clear = (x: number): boolean => {
      const lo = Math.min(x + dir * u0, x + dir * u1) - 2, hi = Math.max(x + dir * u0, x + dir * u1) + 2;
      return ![...shut].some((c) => c >= lo && c <= hi);
    };
    const x = [...Array(Math.round(len / 2)).keys()].flatMap((d) => [x0 + d, x0 - d]).find((c) => c > bx0 && c < bx1 && clear(c)) ?? x0, h = cols[x] ?? 0;
    for (const p of shape) polys.push(p.map(([u, v]) => [x + dir * u, h + v] as const));
  };
  place(fore, fk, ROOT.fore, -1);
  place(aft, ak, ROOT.aft, 1);
  if (horn) place('horn', 0.9 * k, ROOT.horn, 1);
  // The nose on the bow, at the bow's full half-beam.
  if (nose) {
    const { poly, len: n } = noseShape(nose, Math.max(...cols.slice(bx0, bx0 + 4)) + 1);
    polys.push(poly.map(([u, v]) => [bx0 - n + u, v] as const));
  }
  // The grid grown to hold them, the axis kept central.
  const xs = polys.flat().map(([x]) => x), ys = polys.flat().map(([, y]) => y);
  const px = Math.max(0, Math.ceil(-Math.min(0, ...xs)) + 2), pr = Math.max(0, Math.ceil(Math.max(0, ...xs)) - s.width + 3);
  const reach = Math.ceil(Math.max(0, ...ys)) + 2, py = Math.max(0, reach - axis, reach - (s.height - 1 - axis));
  const W = s.width + px + pr, H = s.height + 2 * py, A = axis + py, at = (x: number, y: number): number => y * W + x;
  const body = new Uint8Array(W * H), roomOf = new Int16Array(W * H).fill(-1), cells = Array<string>(W * H).fill('.');
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
    const i = at(x + px, y + py), c = s.rows[y]?.[x] ?? '.';
    cells[i] = c; roomOf[i] = s.roomOf[y * s.width + x] as number;
    if (c !== '.') body[i] = 1;
  }
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  // Kept clear: round the rooms that open out (both sides alike), and astern of the stern within its beam.
  const forbid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = roomOf[at(x, y)] as number;
    if (r < 0 || !OPEN_OUT.includes(roles0[r] as RoomRole)) continue;
    // (A slot from the airlock straight out, its columns and one either side: a blade crossing it is cut clean through.)
    const out = Math.sign(y - A) || 1;
    for (let yy = y; yy >= 0 && yy < H; yy += out) for (let dx = -1; dx <= 1; dx++) for (const ym of [yy, 2 * A - yy]) if (inside(x + dx, ym)) forbid[at(x + dx, ym)] = 1;
  }
  const stern = bx1 + px, sternHalf = (cols[bx1] ?? 0) + 2;
  for (let y = A - sternHalf; y <= A + sternHalf; y++) for (let x = stern - 1; x < W; x++) if (inside(x, y)) forbid[at(x, y)] = 1;
  // The blades rastered at tile centres (mirrored about the axis), then opened by 3x3 with the body.
  const shape = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (body[i]) { shape[i] = 1; continue; }
    if (forbid[i]) continue;
    const u = x - px + 0.5, v = Math.abs(y - A) + 0.5;
    if (polys.some((p) => inPoly(u, v, p))) shape[i] = 1;
  }
  // Gaps narrower than a room's wall pair (a blade running a tile or two off the body's side) closed, by 5x5.
  const closed = square(square(shape, W, H, CLOSE, true), W, H, CLOSE, false);
  for (let i = 0; i < W * H; i++) if (closed[i] && !forbid[i]) shape[i] = 1;
  const full = (x: number, y: number): boolean => N8.every(([dx, dy]) => inside(x + dx, y + dy) && !!shape[at(x + dx, y + dy)]) && !!shape[at(x, y)];
  const open = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (body[i]) open[i] = 1;
    else if (shape[i] && (full(x, y) || N8.some(([dx, dy]) => inside(x + dx, y + dy) && full(x + dx, y + dy)))) open[i] = 1;
  }
  // What joins the body (4-ways) stays.
  const keep = new Uint8Array(W * H), todo: number[] = [];
  for (let i = 0; i < W * H; i++) if (body[i]) { keep[i] = 1; todo.push(i); }
  while (todo.length > 0) {
    const i = todo.pop() as number, x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const j = at(nx, ny);
      if (inside(nx, ny) && open[j] && !keep[j]) { keep[j] = 1; todo.push(j); }
    }
  }
  // The blades' wall (beside space, 8 ways) and floor.
  const floor = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (!keep[i] || body[i]) continue;
    const edge = N8.some(([dx, dy]) => !inside(x + dx, y + dy) || !keep[at(x + dx, y + dy)]);
    cells[i] = '#';
    if (!edge) floor[i] = 1;
  }
  // Rooms on the upper side, each the largest rectangle left, mirrored below; a wall round each.
  const roles = [...roles0];
  const mirror = (y: number): number => 2 * A - y;
  const free = (x: number, y: number): boolean => inside(x, y) && y < A && !!floor[at(x, y)];
  const setFloor = (x: number, y: number, r: number): void => { for (const yy of [y, mirror(y)]) { const i = at(x, yy); cells[i] = '_'; roomOf[i] = r; floor[i] = 0; } };
  const setWall = (x: number, y: number): void => { for (const yy of [y, mirror(y)]) { const i = at(x, yy); cells[i] = '#'; floor[i] = 0; } };
  for (;;) {
    const r = largestRect(free, W, A);
    if (!r) break;
    const [rx, ry, rw, rh] = r, top = roles.length, bottom = top + 1;
    roles.push('cargo', 'cargo');
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
  const rows = Array.from({ length: H }, (_, y) => cells.slice(y * W, (y + 1) * W).join(''));
  return { rows, roomOf, width: W, height: H, roles };
}

/** Where a blade meets the body: the least and most of its length (along its root's line) within two tiles of the side. */
function footprint(shape: Poly[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const p of shape) for (let i = 0; i < p.length; i++) {
    const [ax, ay] = p[i] as readonly [number, number], [bx, by] = p[(i + 1) % p.length] as readonly [number, number];
    for (let t = 0; t <= 1; t += 0.05) {
      const u = ax + (bx - ax) * t, v = ay + (by - ay) * t;
      if (v <= 2) { lo = Math.min(lo, u); hi = Math.max(hi, u); }
    }
  }
  return lo <= hi ? [Math.floor(lo), Math.ceil(hi)] : [0, 0];
}

/** A mask grown (`grow`: any tile within `r`, square) or shrunk (every tile within `r`; past the edge counts as out). */
function square(m: Uint8Array, W: number, H: number, r: number, grow: boolean): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let any = false, all = true;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const on = x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && !!m[(y + dy) * W + x + dx];
      any ||= on; all &&= on;
    }
    out[y * W + x] = (grow ? any : all) ? 1 : 0;
  }
  return out;
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
