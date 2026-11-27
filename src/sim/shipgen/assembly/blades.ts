import type { Rng } from '../../rng';
import type { BladeCombo, BladeKind, BladeSpec, RaiderNose } from '../outlineRecipe';
import type { RoomSpec } from '../plan';
import type { RoomRole } from '../types';
import { bladeRooms } from './bladeRooms';
import { bladeShape, inPoly, noseShape, type Poly } from './bladeShapes';

/**
 * Raider blades (PROTOTYPE, #581): hull added along the body's sides once its rooms are cut, as on the approved mock
 * sheet. The blades are drawn from the palette (bladeShapes.ts), placed at the body's sides and mirrored; the hull rules
 * hold by an opening (every part at least three wide, so a wall a tile thick round floor), and what the opening cuts off
 * the body goes. The blade floor is cut into rooms (bladeRooms.ts), the ship's guns and airlocks among them. Nothing
 * stands just astern of the engines (their exhaust).
 */

export interface Bladed { rows: string[]; roomOf: Int16Array; width: number; height: number; roles: RoomRole[]; specs: (RoomSpec | undefined)[] }

/** Tiles astern of the engines kept clear for their exhaust. */
const EXHAUST = 4;
/** Where along the body the blades root (a fraction of its length from the bow): fore, aft, horn. */
const ROOT = { fore: 0.5, aft: 0.62, horn: 0.59 };
/** The mock's medium body length (its drive block in), at which a blade's scale is 1; the leading end's scale over it, and the other's. */
const MEDIUM = 39, LEAD = 1.15, TRAIL = 0.9;

/** The tallest sliver of space between a blade and the body that is closed (two tiles). */
const CLOSE = 2;

const N8: readonly (readonly [number, number])[] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

export function addBlades(
  rng: Rng, spec: BladeSpec, s: { rows: string[]; roomOf: Int16Array; width: number; height: number }, axis: number,
  roles0: readonly RoomRole[], specs0: readonly (RoomSpec | undefined)[], guns: readonly RoomSpec[],
): Bladed {
  const { fore, aft, lead, horn } = rng.pick(spec.combos as BladeCombo[]), nose = spec.noses ? rng.pick(spec.noses as RaiderNose[]) : null;
  // The body: its columns, and its half-beam at each.
  const body0 = (x: number, y: number): boolean => (s.rows[y]?.[x] ?? '.') !== '.';
  const cols = Array.from({ length: s.width }, (_, x) => { let t = -1; for (let y = 0; y < s.height; y++) if (body0(x, y)) t = Math.max(t, Math.abs(y - axis)); return t; });
  const bx0 = cols.findIndex((t) => t >= 0), bx1 = cols.length - 1 - [...cols].reverse().findIndex((t) => t >= 0), len = bx1 - bx0 + 1;
  const k = len / MEDIUM, [fk, ak] = lead === 'fore' ? [LEAD, TRAIL] : [TRAIL, LEAD];
  // Each blade at its root (on the body's side there), pointing aft (+1) or fore (-1).
  const polys: Poly[] = [];
  const place = (kind: BladeKind | null, kk: number, at: number, dir: number): void => {
    if (!kind) return;
    const shape = bladeShape(kind, kk, k), x = Math.round(bx0 + at * len), h = cols[x] ?? 0;
    for (const p of shape) polys.push(p.map(([u, v]) => [x + dir * u, h + v] as const));
  };
  place(fore, fk, ROOT.fore, -1);
  place(aft, ak, ROOT.aft, 1);
  if (horn) place('horn', 0.9, ROOT.horn, 1);
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
  // Kept clear astern: only the engines' exhaust.
  const forbid = new Uint8Array(W * H);
  // (Astern, only the engines' exhaust: the rows of the engine rooms at the stern wall, a row either side, EXHAUST deep.)
  const stern = bx1 + px;
  for (let y = 0; y < H; y++) {
    if (![y - 1, y, y + 1].some((yy) => roles0[roomOf[at(stern - 1, yy)] ?? -1] === 'engine' || roles0[roomOf[at(stern - 2, yy)] ?? -1] === 'engine')) continue;
    for (let x = stern; x <= stern + EXHAUST && x < W; x++) forbid[at(x, y)] = 1;
  }
  // The blades rastered at tile centres (mirrored about the axis), then opened by 3x3 with the body.
  const shape = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (body[i]) { shape[i] = 1; continue; }
    if (forbid[i]) continue;
    const u = x - px + 0.5, v = Math.abs(y - A) + 0.5;
    if (polys.some((p) => inPoly(u, v, p))) shape[i] = 1;
  }
  // A sliver of space a tile or two tall between a blade and the body (a blade running just off its side) closed, column by
  // column, so the angled space between them keeps its line.
  for (let x = 0; x < W; x++) for (let y = 1; y < H - 1; y++) {
    if (shape[at(x, y)] || !shape[at(x, y - 1)]) continue;
    let e = y;
    while (e < H && !shape[at(x, e)]) e++;
    if (e < H && e - y <= CLOSE) for (let yy = y; yy < e; yy++) if (!forbid[at(x, yy)]) shape[at(x, yy)] = 1;
  }
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
  // The blade floor cut into rooms, the guns and airlocks among them.
  const { roles, specs } = bladeRooms({ cells, roomOf, floor, body, W, H, A }, roles0, specs0, guns);
  const rows = Array.from({ length: H }, (_, y) => cells.slice(y * W, (y + 1) * W).join(''));
  return { rows, roomOf, width: W, height: H, roles, specs };
}
