/**
 * The layout lab's design model: plain serialisable data (rows of tile characters, a room id per tile, rooms, modules), so a
 * later step can diff and save it. Hull is never stored as a choice: it is derived from the tiles by the game's own owner
 * (`outlineOf`, the hull plan's outline: the footprint's tiles that touch open space). Pure functions; every edit returns a new layout.
 */
import { content } from '../../src/content';
import { Sim, footprintTiles, type GenResult, type ModuleDef, type ShipTemplate } from '../../src/sim';
import { outlineOf } from '../../src/sim/yard/width';

export type TemplateModule = NonNullable<ShipTemplate['modules']>[number];
export interface Layout {
  name: string;
  width: number;
  height: number;
  /** One string per row: '.' space, '_' floor, '#' wall, 'D' door, '=' beam. Hull tiles are walls or floor the owner finds on the outer edge. */
  cells: string[];
  /** The room id of each tile (row-major), -1 for none. */
  roomOf: number[];
  /** Rooms by id; the role is a RoomRole id ('cargo', 'hall' for a corridor...). */
  rooms: { role: string }[];
  modules: TemplateModule[];
  /** The rest of the template (crew, faction, boarding...), carried through unchanged. */
  extra: Omit<ShipTemplate, 'name' | 'rows' | 'modules'>;
  /** Stations are immobile: the engine check is off. */
  immobile: boolean;
}
export interface Rect { x: number; y: number; w: number; h: number }
export type Tile = [number, number];

export const PAD = 10;
const defs = content.modules as Record<string, ModuleDef>;
const NONE = -1;

/** A layout from a generator result, padded with open space so the design can grow outward. */
export function layoutOfGen(g: GenResult, name: string, immobile: boolean): Layout {
  const width = g.width + 2 * PAD, height = g.height + 2 * PAD;
  const cells: string[] = [];
  const roomOf = new Array<number>(width * height).fill(NONE);
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const sx = x - PAD, sy = y - PAD;
      const c = sx >= 0 && sy >= 0 && sx < g.width && sy < g.height ? g.template.rows[sy]?.[sx] ?? '.' : '.';
      row += c;
      if (c !== '.') roomOf[y * width + x] = g.roomOf[sy * g.width + sx] ?? NONE;
    }
    cells.push(row);
  }
  const extra: Layout['extra'] = { ...g.template };
  const modules = g.template.modules;
  delete (extra as Partial<ShipTemplate>).name;
  delete (extra as Partial<ShipTemplate>).rows;
  delete (extra as Partial<ShipTemplate>).modules;
  return {
    name, width, height, cells, roomOf, rooms: g.rooms.map((r) => ({ role: String(r.role) })),
    modules: (modules ?? []).map((m) => ({ ...m, x: m.x + PAD, y: m.y + PAD })), extra, immobile,
  };
}

const at = (l: Layout, x: number, y: number): string => (x < 0 || y < 0 || x >= l.width || y >= l.height ? '.' : l.cells[y]?.[x] ?? '.');
export const inBounds = (l: Layout, x: number, y: number): boolean => x >= 0 && y >= 0 && x < l.width && y < l.height;
export const cellAt = at;

let scratch: Sim | undefined;
/** The tiles (by index) that are hull: the owner's outline of the footprint (every tile but space and beams). Doors stay doors. */
export function hullOf(l: Layout): Set<number> {
  scratch ??= new Sim(1, content);
  const tiles: { x: number; y: number }[] = [];
  for (let y = 0; y < l.height; y++) for (let x = 0; x < l.width; x++) { const c = at(l, x, y); if (c !== '.' && c !== '=') tiles.push({ x: x + 1, y: y + 1 }); }
  const out = new Set<number>();
  for (const t of outlineOf(scratch, tiles)) if (at(l, t.x - 1, t.y - 1) !== 'D') out.add((t.y - 1) * l.width + t.x - 1);
  return out;
}

/** The template the game builds from: the cells with the derived hull as wall. */
export function toTemplate(l: Layout): ShipTemplate {
  const hull = hullOf(l);
  const rows = l.cells.map((row, y) => [...row].map((c, x) => (c === '_' && hull.has(y * l.width + x) ? '#' : c)).join(''));
  return { ...l.extra, name: l.name, rows, modules: l.modules.map((m) => ({ ...m })) };
}

// --- edits -------------------------------------------------------------------------------------------------------

interface Work { l: Layout; cells: string[][]; roomOf: number[]; modules: TemplateModule[]; rooms: { role: string }[] }
const work = (l: Layout): Work => ({ l, cells: l.cells.map((r) => [...r]), roomOf: [...l.roomOf], modules: l.modules.map((m) => ({ ...m })), rooms: l.rooms.map((r) => ({ ...r })) });
const done = (w: Work): Layout => ({ ...w.l, cells: w.cells.map((r) => r.join('')), roomOf: w.roomOf, modules: w.modules, rooms: w.rooms });
const idx = (l: Layout, x: number, y: number): number => y * l.width + x;

export function moduleTiles(m: TemplateModule): Tile[] {
  const def = defs[m.def];
  return def ? footprintTiles(def, m.x, m.y, m.rot).map((t): Tile => [t.x, t.y]) : [[m.x, m.y]];
}
const dropModulesOn = (w: Work, hit: (x: number, y: number) => boolean): void => {
  w.modules = w.modules.filter((m) => !moduleTiles(m).some(([x, y]) => hit(x, y)));
};
const set = (w: Work, x: number, y: number, ch: string, room: number): void => {
  if (!inBounds(w.l, x, y)) return;
  (w.cells[y] as string[])[x] = ch;
  w.roomOf[idx(w.l, x, y)] = room;
};

/** The room most of a tile's floor neighbours belong to (-1 if none). */
function neighbourRoom(w: Work, x: number, y: number): number {
  const count = new Map<number, number>();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx, ny = y + dy;
    if (!inBounds(w.l, nx, ny) || w.cells[ny]?.[nx] !== '_') continue;
    const r = w.roomOf[idx(w.l, nx, ny)] ?? NONE;
    if (r >= 0) count.set(r, (count.get(r) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? NONE;
}

/** Paint tiles with a tile kind: '_' floor (joining `room`, else the room beside it), '#' wall, 'D' door, '.' space. Modules the new tile cannot carry go. */
export function paint(l: Layout, tiles: readonly Tile[], ch: '_' | '#' | 'D' | '.', room?: number): Layout {
  const w = work(l);
  const hit = new Set<number>();
  for (const [x, y] of tiles) {
    if (!inBounds(l, x, y) || w.cells[y]?.[x] === ch) continue;
    const r = ch === '_' ? (room !== undefined && room >= 0 ? room : neighbourRoom(w, x, y)) : NONE;
    set(w, x, y, ch, ch === '.' ? NONE : r);
    hit.add(idx(l, x, y));
  }
  if (hit.size === 0) return l;
  if (ch !== '_') dropModulesOn(w, (x, y) => hit.has(idx(l, x, y)));
  return done(w);
}

/** A rectangle of floor for a room (new, or an existing id), walled where the ring around it is open space. */
function carve(w: Work, r: Rect, id: number): void {
  const l = w.l;
  for (let y = r.y - 1; y <= r.y + r.h; y++) {
    for (let x = r.x - 1; x <= r.x + r.w; x++) {
      if (!inBounds(l, x, y)) continue;
      const inside = x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
      if (inside) set(w, x, y, '_', id);
      else if (w.cells[y]?.[x] === '.') set(w, x, y, '#', NONE);
    }
  }
}

/** The bounding box of a room's tiles, and whether they fill it (an edge can be dragged only on a rectangle). */
export function roomRect(l: Layout, id: number): (Rect & { filled: boolean }) | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0;
  for (let i = 0; i < l.roomOf.length; i++) {
    if (l.roomOf[i] !== id || l.cells[Math.floor(i / l.width)]?.[i % l.width] !== '_') continue;
    const x = i % l.width, y = Math.floor(i / l.width);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); n++;
  }
  return n ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, filled: n === (x1 - x0 + 1) * (y1 - y0 + 1) } : null;
}

/** A new room of `role` over a rectangle. Returns the layout and the room's id. */
export function addRoom(l: Layout, r: Rect, role: string): { layout: Layout; id: number } {
  const w = work(l);
  const id = w.rooms.length;
  w.rooms.push({ role });
  carve(w, r, id);
  return { layout: done(w), id };
}

/** Move a rectangular room's edges to `to`: tiles it leaves become wall, tiles it gains floor, the ring around it is walled. */
export function resizeRoom(l: Layout, id: number, to: Rect): Layout {
  const old = roomRect(l, id);
  if (!old?.filled || to.w < 1 || to.h < 1) return l;
  const w = work(l);
  const inNew = (x: number, y: number): boolean => x >= to.x && y >= to.y && x < to.x + to.w && y < to.y + to.h;
  const gone = new Set<number>();
  for (let y = old.y; y < old.y + old.h; y++) for (let x = old.x; x < old.x + old.w; x++) if (!inNew(x, y)) { set(w, x, y, '#', NONE); gone.add(idx(l, x, y)); }
  carve(w, to, id);
  dropModulesOn(w, (x, y) => gone.has(idx(l, x, y)));
  return done(w);
}

/** Split a room across its middle (`axis` 'h': a wall row, 'v': a wall column) with a door in it; the far half is a new room of the same role. */
export function splitRoom(l: Layout, id: number, axis: 'h' | 'v'): { layout: Layout; id: number } | null {
  const r = roomRect(l, id);
  if (!r || (axis === 'h' ? r.h < 3 : r.w < 3)) return null;
  const w = work(l);
  const nid = w.rooms.length;
  w.rooms.push({ role: l.rooms[id]?.role ?? 'cargo' });
  const line = axis === 'h' ? r.y + (r.h >> 1) : r.x + (r.w >> 1);
  const wall = new Set<number>();
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (w.roomOf[idx(l, x, y)] !== id || w.cells[y]?.[x] !== '_') continue;
      const p = axis === 'h' ? y : x;
      if (p === line) { set(w, x, y, '#', NONE); wall.add(idx(l, x, y)); }
      else if (p > line) w.roomOf[idx(l, x, y)] = nid;
    }
  }
  const dx = axis === 'h' ? r.x + (r.w >> 1) : line, dy = axis === 'h' ? line : r.y + (r.h >> 1);
  set(w, dx, dy, 'D', NONE);
  dropModulesOn(w, (x, y) => wall.has(idx(l, x, y)));
  return { layout: done(w), id: nid };
}

export const setRole = (l: Layout, id: number, role: string): Layout => (l.rooms[id] && l.rooms[id].role !== role ? { ...l, rooms: l.rooms.map((r, i) => (i === id ? { role } : r)) } : l);

/** Remove a room's floor (it becomes space; the walls around stay, and the hull is re-derived) and the modules on it. */
export function deleteRoom(l: Layout, id: number): Layout {
  const w = work(l);
  const gone = new Set<number>();
  for (let i = 0; i < l.roomOf.length; i++) if (l.roomOf[i] === id) { const x = i % l.width, y = Math.floor(i / l.width); if (w.cells[y]?.[x] === '_') { set(w, x, y, '.', NONE); gone.add(i); } else w.roomOf[i] = NONE; }
  dropModulesOn(w, (x, y) => gone.has(idx(l, x, y)));
  return done(w);
}

export const addModule = (l: Layout, m: TemplateModule): Layout => ({ ...l, modules: [...l.modules, m] });
export const moveModule = (l: Layout, i: number, x: number, y: number, rot: number): Layout => (l.modules[i] ? { ...l, modules: l.modules.map((m, k) => (k === i ? { ...m, x, y, rot } : m)) } : l);
export const removeModule = (l: Layout, i: number): Layout => ({ ...l, modules: l.modules.filter((_, k) => k !== i) });
/** Rotate a module a quarter turn about its top-left tile. */
export const rotateModule = (l: Layout, i: number): Layout => { const m = l.modules[i]; return m ? moveModule(l, i, m.x, m.y, (m.rot + 1) % 4) : l; };

export const moduleDef = (id: string): ModuleDef | undefined => defs[id];
