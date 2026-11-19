/**
 * Rectangles of a layout lifted out as a piece (the Move tool's selection, the clipboard) and stamped back somewhere. A piece is plain
 * data: its tiles, the rooms they belong to, the modules and windows wholly inside it, and the per-tile template rows (floor finishes,
 * ground cable, tubes). Open space in a piece is transparent: stamping it leaves what is underneath. Pure functions.
 */
import { inBounds, moduleTiles, takeModuleId, takeRoomId, type Layout, type Rect, type TemplateModule, type Tile } from './layout';
import { keepWindows, windowTiles, windowsOf, type LayoutWindow } from './windows';

/** The template rows that run row for row with the cells. */
const ROWS = ['floors', 'cable', 'tubes'] as const;
type RowKey = (typeof ROWS)[number];
const EMPTY = '.';

export interface Piece {
  w: number;
  h: number;
  /** Rows of tile characters ('.' is transparent). */
  cells: string[];
  /** Per tile (row-major over w), an index into `rooms`, or -1. */
  roomOf: number[];
  /** The rooms the piece's tiles belong to: their role, the id they had, and whether the piece holds every tile of it. */
  rooms: { role: string; id: number; whole: boolean }[];
  /** Modules wholly inside, at positions relative to the piece, with the stable id they had. */
  modules: { m: TemplateModule; id: number }[];
  /** Windows wholly inside, relative to the piece. */
  windows: LayoutWindow[];
  /** The per-tile template rows over the piece (only those the layout has). */
  rows: Partial<Record<RowKey, string[]>>;
}

const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
/** A rectangle from two corner tiles (inclusive). */
export const rectOf = (a: Tile, b: Tile): Rect => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]) + 1, h: Math.abs(b[1] - a[1]) + 1 });
export const rectTiles = (r: Rect): Tile[] => {
  const out: Tile[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push([x, y]);
  return out;
};
/** The rectangle clipped to the layout (null when nothing is left). */
export function clipRect(l: Layout, r: Rect): Rect | null {
  const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(l.width, r.x + r.w), y1 = Math.min(l.height, r.y + r.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** The rectangle grown until no module or window lies partly in it, so a piece always holds whole things. */
export function wholeRect(l: Layout, r: Rect): Rect {
  let cur = r;
  for (;;) {
    let x0 = cur.x, y0 = cur.y, x1 = cur.x + cur.w - 1, y1 = cur.y + cur.h - 1;
    const things = [...l.modules.map(moduleTiles), ...windowsOf(l).map(windowTiles)];
    for (const t of things) {
      if (!t.some(([x, y]) => inRect(cur, x, y))) continue;
      for (const [x, y] of t) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    const next = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    if (next.x === cur.x && next.y === cur.y && next.w === cur.w && next.h === cur.h) return cur;
    cur = next;
  }
}

/** The piece under a rectangle (call `wholeRect` first: a module or window partly outside is left out). */
export function extract(l: Layout, r: Rect): Piece {
  const cells: string[] = [], roomOf: number[] = [], rooms: Piece['rooms'] = [], local = new Map<number, number>();
  for (let y = r.y; y < r.y + r.h; y++) {
    let row = '';
    for (let x = r.x; x < r.x + r.w; x++) {
      const c = inBounds(l, x, y) ? l.cells[y]?.[x] ?? EMPTY : EMPTY;
      row += c;
      const id = c !== EMPTY && inBounds(l, x, y) ? l.roomOf[y * l.width + x] ?? -1 : -1;
      if (id < 0) { roomOf.push(-1); continue; }
      if (!local.has(id)) { local.set(id, rooms.length); rooms.push({ role: l.rooms[id]?.role ?? 'hall', id, whole: true }); }
      roomOf.push(local.get(id) as number);
    }
    cells.push(row);
  }
  for (let i = 0; i < l.roomOf.length; i++) {
    const k = local.get(l.roomOf[i] ?? -1);
    if (k !== undefined && !inRect(r, i % l.width, Math.floor(i / l.width))) (rooms[k] as Piece['rooms'][number]).whole = false;
  }
  const inside = (t: Tile[]): boolean => t.every(([x, y]) => inRect(r, x, y));
  const modules = l.modules.flatMap((m, i) => (inside(moduleTiles(m)) ? [{ m: { ...m, x: m.x - r.x, y: m.y - r.y }, id: l.moduleIds[i] as number }] : []));
  const windows = windowsOf(l).filter((w) => inside(windowTiles(w))).map((w) => ({ ...w, x: w.x - r.x, y: w.y - r.y }));
  const rows: Piece['rows'] = {};
  for (const k of ROWS) {
    const src = l.extra[k];
    if (src) rows[k] = Array.from({ length: r.h }, (_, j) => Array.from({ length: r.w }, (_, i) => src[r.y + j]?.[r.x + i] ?? EMPTY).join(''));
  }
  return { w: r.w, h: r.h, cells, roomOf, rooms, modules, windows, rows };
}

/** Write characters into template rows over a set of tiles (a row too short is padded with the empty character). */
function writeRows(rows: readonly string[] | undefined, height: number, put: (x: number, y: number) => string | null, tiles: readonly Tile[]): string[] {
  const out = Array.from({ length: height }, (_, y) => [...(rows?.[y] ?? '')]);
  for (const [x, y] of tiles) {
    const ch = put(x, y);
    const row = out[y];
    if (ch === null || !row) continue;
    while (row.length <= x) row.push(EMPTY);
    row[x] = ch;
  }
  return out.map((r) => r.join(''));
}

/**
 * Clear a rectangle: its tiles become open space, except a tile beside floor or a door left outside it (eight neighbours), which becomes wall,
 * so a room the box cut through or stood against stays sealed. The modules, windows and template rows in it go.
 */
export function lift(l: Layout, r: Rect): Layout {
  const tiles = rectTiles(r).filter(([x, y]) => inBounds(l, x, y));
  if (!tiles.length) return l;
  const cells = l.cells.map((row) => [...row]), roomOf = [...l.roomOf];
  // only floor and doors need closing in (a wall left beside open space is already a wall)
  const solid = (x: number, y: number): boolean => !inRect(r, x, y) && inBounds(l, x, y) && ['_', 'D'].includes(l.cells[y]?.[x] ?? EMPTY);
  const edge = (x: number, y: number): boolean => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => solid(x + dx, y + dy)));
  for (const [x, y] of tiles) { (cells[y] as string[])[x] = edge(x, y) ? '#' : EMPTY; roomOf[y * l.width + x] = -1; }
  const keep = l.modules.map((m) => !moduleTiles(m).some(([x, y]) => inRect(r, x, y)));
  const extra = { ...l.extra };
  for (const k of ROWS) if (extra[k]) extra[k] = writeRows(extra[k], l.height, () => EMPTY, tiles);
  const windows = windowsOf(l).filter((w) => !windowTiles(w).some(([x, y]) => inRect(r, x, y)));
  const next: Layout = { ...l, cells: cells.map((row) => row.join('')), roomOf, extra, modules: l.modules.filter((_, i) => keep[i]), moduleIds: l.moduleIds.filter((_, i) => keep[i]) };
  delete next.windows;
  return windows.length ? { ...next, windows } : next;
}

/** Ids for what a stamp adds: `keep` reuses a room's id when the piece holds all of it and every module's id (a move); else new ones from the session's marks (a paste). */
export interface Marks { module: number; room: number }

/**
 * Stamp a piece with its top-left at (x, y). Its open space is transparent. Each tile it writes replaces what was there, and the modules
 * and windows standing on those tiles go; the piece's own modules and windows are added. Tiles off the grid are dropped (call `fitPiece`).
 * Returns the layout and the session marks after the ids it took.
 */
export function stamp(l: Layout, p: Piece, x: number, y: number, keep: boolean, marks: Marks): { layout: Layout; marks: Marks } {
  const written: Tile[] = [];
  const cells = l.cells.map((row) => [...row]), roomOf = [...l.roomOf], rooms = l.rooms.map((r) => ({ ...r }));
  let { module: mMark, room: rMark } = marks;
  const roomIds = p.rooms.map((r) => {
    if (keep && r.whole) return r.id;
    const t = takeRoomId({ ...l, rooms }, rMark);
    rMark = t.mark;
    while (rooms.length < t.id) rooms.push({ role: 'hall' });
    rooms[t.id] = { role: r.role };
    return t.id;
  });
  for (let j = 0; j < p.h; j++) {
    for (let i = 0; i < p.w; i++) {
      const c = p.cells[j]?.[i] ?? EMPTY, tx = x + i, ty = y + j;
      if (c === EMPTY || !inBounds(l, tx, ty)) continue;
      (cells[ty] as string[])[tx] = c;
      const r = p.roomOf[j * p.w + i] ?? -1;
      roomOf[ty * l.width + tx] = r >= 0 ? (roomIds[r] as number) : -1;
      written.push([tx, ty]);
    }
  }
  const hit = new Set(written.map(([tx, ty]) => ty * l.width + tx));
  const placed = p.modules.map(({ m, id }) => ({ m: { ...m, x: m.x + x, y: m.y + y }, id }));
  const on = (t: Tile[]): boolean => t.some(([tx, ty]) => hit.has(ty * l.width + tx));
  // a placed module's own tiles may be open ground (a ground turret): it still clears what stands there
  const covered = new Set(placed.flatMap(({ m }) => moduleTiles(m)).map(([tx, ty]) => ty * l.width + tx));
  const gone = l.modules.map((m) => on(moduleTiles(m)) || moduleTiles(m).some(([tx, ty]) => covered.has(ty * l.width + tx)));
  const modules = l.modules.filter((_, i) => !gone[i]), moduleIds = l.moduleIds.filter((_, i) => !gone[i]);
  let nextModuleId = l.nextModuleId;
  for (const { m, id } of placed) {
    if (!moduleTiles(m).every(([tx, ty]) => inBounds(l, tx, ty))) continue;
    let mid = id;
    if (!keep) { const t = takeModuleId({ ...l, nextModuleId }, mMark); mid = t.id; mMark = t.mark; }
    modules.push(m);
    moduleIds.push(mid);
    nextModuleId = Math.max(nextModuleId, mid + 1);
  }
  const extra = { ...l.extra };
  const area = rectTiles({ x, y, w: p.w, h: p.h }).filter(([tx, ty]) => inBounds(l, tx, ty));
  for (const k of ROWS) {
    const src = p.rows[k];
    if (!src && !extra[k]) continue;
    // a row's character goes where the piece has a tile or a mark of its own (ground cable runs over open space)
    extra[k] = writeRows(extra[k], l.height, (tx, ty) => {
      const ch = src?.[ty - y]?.[tx - x] ?? EMPTY;
      return ch !== EMPTY || hit.has(ty * l.width + tx) ? ch : null;
    }, area);
  }
  const windows = [
    ...windowsOf(l).filter((w) => !on(windowTiles(w))),
    ...p.windows.map((w) => ({ ...w, x: w.x + x, y: w.y + y })).filter((w) => windowTiles(w).every(([tx, ty]) => inBounds(l, tx, ty))),
  ];
  const next: Layout = { ...l, cells: cells.map((row) => row.join('')), roomOf, rooms, modules, moduleIds, nextModuleId, extra };
  delete next.windows;
  // a window kept only where its tiles are wall (a stamped tile over one's run drops it above; one in the piece lies on the piece's walls)
  const out = keepWindows(windows.length ? { ...next, windows } : next, next.cells);
  return { layout: out, marks: { module: mMark, room: rMark } };
}

/** The top-left a piece is stamped at, kept on the grid. */
export function fitPiece(l: Layout, p: Piece, x: number, y: number): Tile {
  return [Math.max(0, Math.min(l.width - p.w, x)), Math.max(0, Math.min(l.height - p.h, y))];
}

/** Whether a piece holds anything at all (an empty box copies nothing). */
export const isEmpty = (p: Piece): boolean => p.cells.every((r) => [...r].every((c) => c === EMPTY)) && !p.modules.length && !Object.values(p.rows).some((rows) => rows?.some((r) => [...r].some((c) => c !== EMPTY)));
