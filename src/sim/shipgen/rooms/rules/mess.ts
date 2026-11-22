/**
 * A mess's arrangement as laid (rules.ts, M1 to M4): the doorways kept clear, its tables (`messTables`: the planned
 * ones, more in a mess bigger than the programme would make it) by the galleys, a pair of galleys at most, the game
 * table against a wall with room round it and the life support out of the way. Room frame of parts.ts: (0, 0) the
 * top-left floor tile, the main door under the bottom wall at column d.
 */
import { accessTiles, footprintTiles } from '../../../modules/footprint';
import { stretchOf } from '../../assembly/sizing';
import type { Piece } from './check';
import { C, G, GT, LS, P, T, count, middle, off } from './parts';
import type { Ctx } from './rules';

/**
 * A mess's floor for its tables and galleys, long side then short (the one answer: the programme and the ship plans size
 * a mess by it, the mess rules tell a hall from a mess by it): the smallest room where some arrangement below places
 * every table with its chairs, the galleys and a game table, for a main door anywhere on a long wall and a second door
 * (a pantry's) anywhere on an end wall (a sweep of every door pair, every size from the floor up, finds no failure). A
 * single line of tables down a room five deep where that is smaller; the two lines of M4, seven deep (a liner bay's
 * depth), where they come within a tenth of it. `depth` 4: a hull's side rooms are four deep, one line.
 */
export function messFloor(tables: number, galleys = 1, depth = 0): { w: number; h: number } {
  const t = Math.max(1, Math.round(tables)), two = galleys >= 2;
  if (depth > 0 && depth < 5) return { w: 4 * t + 4 + (two ? 4 : 0), h: 4 };
  // Measured widths by tables (1 to 4), one galley then a pair (the most a mess takes).
  const line = two ? [11, 15, 19, 23] : [6, 9, 14, 15], lines = two ? [8, 11, 15, 18] : [7, 7, 10, 11];
  const w1 = line[t - 1] ?? 3 * t + 3 + (two ? 8 : 0), w2 = Math.max(7, lines[t - 1] ?? 3 * Math.ceil(t / 2) + 5 + (two ? 7 : 0));
  return w2 * 7 * 10 <= w1 * 5 * 11 ? { w: w2, h: 7 } : { w: w1, h: 5 };
}

/**
 * The tables a mess holds: the planned ones (seats for its share of the crew); a mess bigger than the programme would
 * make it (past its stretch: a hub mess, as long as the branches off it need) furnishes to its size, its tables in
 * proportion to its floor.
 */
export function messTables(c: { w: number; h: number; need: readonly string[] }): number {
  const planned = Math.max(1, count(c.need, T)), { w: a, h: b } = messFloor(planned);
  const most = a * b * stretchOf({ role: 'support', dept: 'commons', mods: [], w: a, h: b });
  return Math.max(planned, Math.round((planned * c.w * c.h) / most));
}

const key = (x: number, y: number): string => `${x},${y}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** The tiles of each doorway: three wide (the door's column and either side) and two deep from the door. */
export function doorways(c: Ctx): Set<string> {
  const out = new Set<string>();
  const add = (x: number, y: number, dx: number, dy: number): void => { for (const k of [0, 1]) for (const s of [-1, 0, 1]) out.add(key(x + k * dx + s * dy, y + k * dy + s * dx)); };
  add(c.d, c.h - 1, 0, -1);
  for (const e of c.doors ?? []) {
    const [dx, dy] = e.y === 0 ? [0, 1] : e.y === c.h - 1 ? [0, -1] : e.x === 0 ? [1, 0] : [-1, 0];
    add(e.x, e.y, dx, dy);
  }
  return out;
}

/** Whether a frame tile is floor: inside the frame and not a cut corner. */
const onFloor = (c: Ctx, x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.w && y < c.h && !(c.cut ?? []).some((t) => t.x === x && t.y === y);

/**
 * A spot for `id` against a wall, out of the way: off the doorways and a tile off the other pieces at least (`ring`:
 * every floor tile round it open and its players' tiles floor, so a game table has room to play at; else a machine);
 * then as far from the other pieces and the doorways as it goes (three tiles is room enough).
 */
function aside(c: Ctx, id: string, pieces: readonly Piece[], clear: ReadonlySet<string>, ring: boolean): Piece | null {
  const def = c.defs[id];
  if (!def) return null;
  const taken: [number, number][] = pieces.flatMap((p) => (c.defs[p.def] ? footprintTiles(c.defs[p.def] as NonNullable<Ctx['defs'][string]>, p.x, p.y, p.rot).map((t): [number, number] => [t.x, t.y]) : []));
  const doors = [...clear].map((s) => s.split(',').map(Number) as [number, number]);
  const near = (fp: readonly { x: number; y: number }[], list: readonly [number, number][]): number => Math.min(3, ...list.map(([x, y]) => Math.min(...fp.map((t) => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)))) - 1));
  let best: Piece | null = null, score = -Infinity;
  for (const rot of ring ? [0, 1] : [0]) for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const fp = footprintTiles(def, x, y, rot);
    if (!fp.every((t) => onFloor(c, t.x, t.y)) || !accessTiles(def, x, y, rot).every((t) => onFloor(c, t.x, t.y))) continue;
    const round = ring ? fp.flatMap((t) => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [t.x + dx, t.y + dy] as const))) : fp.map((t) => [t.x, t.y] as const);
    if (!round.every(([a, b]) => !taken.some(([tx, ty]) => tx === a && ty === b))) continue;
    if (fp.some((t) => clear.has(key(t.x, t.y)))) continue;
    const wall = Math.min(...fp.map((t) => Math.min(t.x, t.y, c.w - 1 - t.x, c.h - 1 - t.y)));
    const room = near(fp, taken), clearOf = near(fp, doors);
    if (room < 1 || clearOf < 1 || wall > 0) continue;
    const s = room + clearOf;
    if (s > score) { score = s; best = P(id, x, y, rot); }
  }
  return best;
}

/**
 * A line of `most` tables (each with its chairs) clear of the doorways: `lay(m)` lays m evenly along the line; the first
 * count from `most` up whose tables leave `most` clear, those spread evenly along it; else the count that leaves the
 * most clear, if that is `least` at least. Empty when none does.
 */
function lineClear(c: Ctx, most: number, least: number, lay: (m: number) => Piece[]): Piece[] {
  if (most < 1) return [];
  const clear = doorways(c);
  const free = (p: Piece): boolean => { const d = c.defs[p.def]; return (d ? footprintTiles(d, p.x, p.y, p.rot) : [p]).every((t) => !clear.has(key(t.x, t.y))); };
  const fp = (t: Piece): Set<string> => new Set((c.defs[T] ? footprintTiles(c.defs[T], t.x, t.y, t.rot) : [t]).map((q) => key(q.x, q.y)));
  const by = (at: ReadonlySet<string>) => (q: Piece): boolean => q.def === C && N4.some(([dx, dy]) => at.has(key(q.x + dx, q.y + dy)));
  const keep = (pieces: Piece[], pick: Piece[]): Piece[] => { const at = new Set(pick.flatMap((t) => [...fp(t)])); return pieces.filter((p) => pick.includes(p) || by(at)(p)); };
  let best: { pieces: Piece[]; ok: Piece[] } | null = null;
  for (let m = most, last = -1; m <= 64; m++) {
    const pieces = lay(m).filter((p) => p.def !== GT), tabs = pieces.filter((p) => p.def === T);
    if (tabs.length === last) break;
    last = tabs.length;
    // A table and its chairs all clear.
    const ok = tabs.filter((t) => free(t) && pieces.filter(by(fp(t))).every(free));
    if (ok.length < most) { if (!best || ok.length > best.ok.length) best = { pieces, ok }; continue; }
    return keep(pieces, most <= 1 ? [ok[(ok.length - 1) >> 1] as Piece] : Array.from({ length: most }, (_, i) => ok[Math.round((i * (ok.length - 1)) / (most - 1))] as Piece));
  }
  return best && best.ok.length >= least && best.ok.length > 0 ? keep(best.pieces, best.ok) : [];
}

/**
 * `lineClear` where the line may stand a tile off the middle across the room: moved that far across (`tall`: along x),
 * for a doorway on one side that a centred table's chairs would block. The centred line first, then a tile either way;
 * the first that holds `most` tables, else the one with the most.
 */
export function tablesClear(c: Ctx, most: number, least: number, lay: (m: number) => Piece[], tall = false): Piece[] {
  let best: Piece[] = [];
  const n = (ps: Piece[]): number => ps.filter((p) => p.def === T).length;
  for (const shift of [0, -1, 1]) {
    const got = lineClear(c, most, least, (m) => lay(m).map((p) => (tall ? { ...p, x: p.x + shift } : { ...p, y: p.y + shift })));
    if (n(got) >= most) return got;
    if (n(got) > n(best)) best = got;
  }
  return best;
}

/**
 * M4: a long mess: the galleys on a short wall, tables with their chairs down the long axis in a line (two where the
 * room is wide enough across, either side of the middle), its tables (`messTables`) shared between the lines, each line's
 * evenly spaced and centred (`middle`), clear of the doorways (`tablesClear`). Where that holds fewer than the planned
 * tables and the room is seven across or more: two lines with their chairs against the walls (`flush`).
 */
export function m4(c: Ctx): Piece[] {
  const tall = c.h > c.w, across = tall ? c.w : c.h, n = messTables(c), planned = Math.max(1, count(c.need, T));
  // In the corners of the short wall, a tile in where a corner is cut.
  const galleys = tall
    ? [P(G, off(c, 0, 0, 0, 1), 0, 0), ...(c.w >= 5 ? [P(G, off(c, c.w - 1, 0, c.w - 2, -1), 0, 0)] : [])]
    : [P(G, 0, off(c, 0, 0, 0, 1), 3), ...(c.h >= 5 ? [P(G, 0, off(c, 0, c.h - 1, c.h - 2, -1), 3)] : [])];
  const build = (lines: number, flush: boolean): Piece[] => {
    // Each line's band across the room: the whole of it, or the halves either side of its middle, a tile in from the
    // walls where the room is wide (an aisle down each wall two wide, clear of the doorways in it).
    const inset = across >= 11 ? 1 : 0;
    const bands = lines === 1 ? [[0, across - 1]] : [[inset, (across >> 1) - 1], [(across + 1) >> 1, across - 1 - inset]];
    return bands.flatMap(([a, b], k) => {
      const most = Math.floor(n / lines) + (k < n % lines ? 1 : 0), least = Math.floor(planned / lines) + (k < planned % lines ? 1 : 0);
      return tablesClear(c, most, least, (m) => (tall ? middle(a as number, 2, b as number, c.h - 1, false, true, m, flush) : middle(2, a as number, c.w - 1, b as number, true, true, m, flush)), tall);
    });
  };
  const tables = (ps: Piece[]): number => ps.filter((p) => p.def === T).length;
  let line = build(across >= 9 ? 2 : 1, false);
  if (tables(line) < planned && across >= 7) { const alt = build(2, true); if (tables(alt) > tables(line)) line = alt; }
  return [...galleys, ...line];
}

/** A mess arrangement as laid: see the file comment. */
export function laid(c: Ctx, pieces: readonly Piece[]): Piece[] {
  const clear = doorways(c);
  const tiles = (p: Piece): { x: number; y: number }[] => { const d = c.defs[p.def]; return d ? footprintTiles(d, p.x, p.y, p.rot) : [{ x: p.x, y: p.y }]; };
  // Life support only where the plan put it (a ship's stands in its plant room): an arrangement's own unit goes when the room asked for none.
  let out = pieces.filter((p) => tiles(p).every((t) => !clear.has(key(t.x, t.y)) && onFloor(c, t.x, t.y)) && (p.def !== LS || c.need.includes(LS)));
  // A table stands only with a chair on two sides at least (a chair off the floor or in a doorway is gone).
  const seated = (p: Piece): boolean => out.filter((q) => q.def === C && N4.some(([dx, dy]) => tiles(p).some((t) => t.x === q.x + dx && t.y === q.y + dy))).length >= 2;
  out = out.filter((p) => p.def !== T || seated(p));
  // A pair of galleys at most; its tables (`messTables`), those nearest the galleys (the dining end).
  const galleys = out.filter((p) => p.def === G).slice(0, 2), n = messTables(c), planned = Math.max(1, count(c.need, T));
  const [cx, cy] = galleys.length > 0 ? [galleys.reduce((t, p) => t + p.x, 0) / galleys.length, galleys.reduce((t, p) => t + p.y, 0) / galleys.length] : [(c.w - 1) / 2, (c.h - 1) / 2];
  const tabs = out.filter((p) => p.def === T).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, n);
  // Every planned table laid with its chairs, or the arrangement does not suit the room (a placer would stand the rest
  // chairless against a wall).
  if (tabs.length < planned) return [];
  out = out.filter((p) => (p.def !== T || tabs.includes(p)) && (p.def !== G || galleys.includes(p)));
  // Chairs only at a table that stands.
  const at = new Set(tabs.flatMap((p) => tiles(p).map((t) => key(t.x, t.y))));
  out = out.filter((p) => p.def !== C || N4.some(([dx, dy]) => at.has(key(p.x + dx, p.y + dy))));
  // The game table and the life support where the rule leaves them to the placer: out of the way.
  for (const [id, ring] of [[GT, true], [LS, false]] as const) {
    if (!c.need.includes(id) || out.some((p) => p.def === id)) continue;
    const q = aside(c, id, out, clear, ring);
    if (q) out.push(q);
  }
  return out;
}
