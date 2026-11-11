import { describe, expect, it } from 'vitest';
import { commit, fresh, live, redo, undo } from './history';
import {
  addModule, addRoom, deleteRoom, hullOf, moveModule, paint, removeModule, resizeRoom, roomRect, rotateModule, setRole, splitRoom, toTemplate,
  type Layout, type Tile,
} from './layout';
import { problemsOf } from './problems';
import { buildLayout, DEFAULT_SOURCE } from './source';
import { placementProblem } from './world';

const blank = (w = 24, h = 18): Layout => ({
  name: 'test', width: w, height: h, cells: Array.from({ length: h }, () => '.'.repeat(w)), roomOf: new Array<number>(w * h).fill(-1), rooms: [], modules: [], extra: {}, immobile: true,
});
const rect = (x: number, y: number, w: number, h: number): Tile[] => { const t: Tile[] = []; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) t.push([i, j]); return t; };
const rows = (l: Layout): string[] => toTemplate(l).rows;

describe('layout edits', () => {
  it('derives the hull as the outer edge of the floor, one tile thick', () => {
    const l = paint(blank(), rect(4, 4, 6, 5), '_');
    const r = rows(l);
    expect(r[4]?.slice(4, 10)).toBe('######');
    expect(r[5]?.slice(4, 10)).toBe('#____#');
    expect(r[8]?.slice(4, 10)).toBe('######');
    expect(hullOf(l).size).toBe(6 * 5 - 4 * 3);
    // the stored cells stay plain floor: hull is not a choice
    expect(l.cells[5]?.[4]).toBe('_');
  });
  it('floor painted outward turns the old hull into floor, and keeps deliberate interior walls', () => {
    const { layout, id } = addRoom(blank(), { x: 5, y: 5, w: 6, h: 6 }, 'cargo');
    const walled = paint(layout, [[7, 7]], '#');
    const out = paint(walled, rect(11, 5, 3, 6), '_', id);
    // the old east wall (x = 11, a hull tile stored as wall) is floor now; the new edge x = 13 is the hull
    for (let y = 5; y < 11; y++) { expect(out.cells[y]?.[11]).toBe('_'); expect(out.roomOf[y * out.width + 11]).toBe(id); }
    expect(rows(out)[7]?.[13]).toBe('#');
    expect(out.cells[7]?.[7]).toBe('#');
    expect(hullOf(out).has(7 * out.width + 11)).toBe(false);
  });
  it('a freed hull tile joins a room only when the rooms beside it agree', () => {
    const strip = (right: number): Layout => {
      let l = paint(blank(), [[4, 5], [6, 5]], '_');
      l = paint(l, [[5, 5]], '#');
      return { ...l, rooms: [{ role: 'cargo' }, { role: 'mess' }], roomOf: l.roomOf.map((r, i) => (i === 5 * l.width + 4 ? 0 : i === 5 * l.width + 6 ? right : r)) };
    };
    const ring = [...rect(3, 3, 5, 5)].filter(([x, y]) => !(x === 5 && y === 5) && !(y === 5 && (x === 4 || x === 6)));
    const between = paint(strip(1), ring, '_');
    expect(between.cells[5]?.[5]).toBe('_');
    expect(between.roomOf[5 * between.width + 5]).toBe(-1);
    const same = paint(strip(0), ring, '_');
    expect(same.roomOf[5 * same.width + 5]).toBe(0);
  });
  it('painting floor never drops a module', () => {
    const { layout } = buildLayout({ ...DEFAULT_SOURCE, kind: 'starter', id: 'ship.wayfarer' });
    const out = paint(layout, rect(36, 7, 7, 7), '_');
    expect(out.modules).toEqual(layout.modules);
  });
  it('derives hull around holes too', () => {
    let l = paint(blank(), rect(3, 3, 10, 9), '_');
    l = paint(l, rect(7, 6, 2, 2), '.');
    const r = rows(l);
    expect(r[5]?.slice(6, 10)).toBe('_##_');
    expect(r[6]?.slice(6, 10)).toBe('#..#');
    expect(r[8]?.slice(6, 10)).toBe('_##_');
  });
  it('reproduces a generated layout exactly (the owner finds the same hull the generator drew)', () => {
    for (const s of [{ ...DEFAULT_SOURCE, size: 'outpost' }, { ...DEFAULT_SOURCE, kind: 'faction' as const, id: 'faction.navy', layout: '' }]) {
      const { layout } = buildLayout(s);
      expect(toTemplate(layout).rows).toEqual(layout.cells);
    }
  });
  it('walls, doors and space take modules off the tiles', () => {
    let l = paint(blank(), rect(3, 3, 10, 9), '_');
    l = addModule(l, { def: 'module.chair', x: 6, y: 6, rot: 0 });
    expect(paint(l, [[6, 6]], '#').modules).toHaveLength(0);
    expect(paint(l, [[6, 6]], '_')).toBe(l);
    expect(paint(l, [[6, 6]], 'D').cells[6]?.[6]).toBe('D');
  });
  it('draws a room: floor, a wall ring, a role', () => {
    const { layout, id } = addRoom(blank(), { x: 5, y: 5, w: 6, h: 4 }, 'cargo');
    expect(layout.rooms[id]).toEqual({ role: 'cargo' });
    expect(roomRect(layout, id)).toEqual({ x: 5, y: 5, w: 6, h: 4, filled: true });
    expect(layout.cells[4]?.slice(4, 12)).toBe('########');
    expect(layout.cells[5]?.slice(4, 12)).toBe('#______#');
  });
  it('resizes a room by an edge: floor gained, wall moved out', () => {
    const { layout, id } = addRoom(blank(), { x: 5, y: 5, w: 6, h: 4 }, 'cargo');
    const wider = resizeRoom(layout, id, { x: 5, y: 5, w: 8, h: 4 });
    expect(roomRect(wider, id)).toMatchObject({ w: 8, h: 4 });
    expect(wider.cells[5]?.slice(4, 14)).toBe('#________#');
    const narrower = resizeRoom(wider, id, { x: 5, y: 5, w: 3, h: 4 });
    expect(roomRect(narrower, id)).toMatchObject({ w: 3 });
    expect(narrower.cells[5]?.slice(4, 10)).toBe('#___#.'.replace('.', '#'));
  });
  it('splits a room with a wall and a door, retypes and deletes it', () => {
    const { layout, id } = addRoom(blank(), { x: 4, y: 4, w: 8, h: 5 }, 'plaza');
    const s = splitRoom(layout, id, 'v');
    expect(s).not.toBeNull();
    const l = (s as NonNullable<typeof s>).layout;
    expect(l.rooms).toHaveLength(2);
    expect(l.rooms[1]?.role).toBe('plaza');
    expect(l.cells.some((r) => r.includes('D'))).toBe(true);
    expect(roomRect(l, id)?.w).toBe(4);
    expect(setRole(l, 0, 'shop').rooms[0]?.role).toBe('shop');
    const gone = deleteRoom(l, id);
    expect(roomRect(gone, id)).toBeNull();
    expect(splitRoom(addRoom(blank(), { x: 4, y: 4, w: 8, h: 2 }, 'cargo').layout, 0, 'h')).toBeNull();
  });
  it('adds, moves, turns and removes modules', () => {
    let l = addModule(blank(), { def: 'module.chair', x: 1, y: 2, rot: 0 });
    l = moveModule(l, 0, 4, 5, 2);
    expect(l.modules[0]).toMatchObject({ x: 4, y: 5, rot: 2 });
    expect(rotateModule(l, 0).modules[0]?.rot).toBe(3);
    expect(removeModule(l, 0).modules).toHaveLength(0);
  });
  it('asks the game for placement validity', () => {
    const { layout } = addRoom(blank(), { x: 5, y: 5, w: 8, h: 6 }, 'support');
    expect(placementProblem(layout, 'module.chair', 7, 7, 0)).toBeNull();
    expect(placementProblem(layout, 'module.chair', 1, 1, 0)).toBe('notFloor');
    const placed = addModule(layout, { def: 'module.chair', x: 7, y: 7, rot: 0 });
    expect(placementProblem(placed, 'module.chair', 7, 7, 0)).toBe('occupied');
    expect(placementProblem(placed, 'module.chair', 7, 7, 0, 0)).toBeNull(); // the module being moved does not block itself
  });
  it('reports the game validator\'s problems with places to click', () => {
    const { layout } = addRoom(blank(), { x: 5, y: 5, w: 8, h: 6 }, 'support');
    const withChair = addModule(layout, { def: 'module.chair', x: 1, y: 1, rot: 0 });
    const texts = problemsOf(withChair).map((p) => p.text);
    expect(texts.some((t) => t.includes('off the floor'))).toBe(true);
    expect(texts).toContain('no door');
    const off = problemsOf(withChair).find((p) => p.text.includes('off the floor'));
    expect(off?.module).toBe(0);
    expect(off?.tiles.length).toBeGreaterThan(0);
  });
});

describe('undo and redo', () => {
  it('makes one step of a gesture and keeps redo until a new edit', () => {
    let h = fresh(1);
    const before = h.present;
    h = live(live(h, 2), 3);
    h = commit(h, before);
    expect(h.past).toEqual([1]);
    expect(commit(h, h.present)).toBe(h);
    h = undo(h);
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(3);
    h = undo(h);
    h = commit(live(h, 9), h.present);
    expect(h.future).toEqual([]);
    expect(undo(fresh(0))).toEqual(fresh(0));
  });
});

describe('preview restamp', () => {
  it('replaces the ship in the same sim: the old tiles go, the new ones stand', async () => {
    const { shipGrid } = await import('../../src/sim');
    const { buildWorld, restamp } = await import('./world');
    const a = paint(blank(), rect(4, 4, 6, 5), '_');
    const w = buildWorld(a);
    expect(w).not.toBeNull();
    if (!w) return;
    const b = paint(blank(), rect(12, 6, 4, 4), '_');
    const ship = restamp(w.sim, w.ship, b);
    expect(ship).not.toBeNull();
    const grid = ship === null ? undefined : shipGrid(w.sim, ship);
    expect(grid).toBeDefined();
    expect(shipGrid(w.sim, w.ship)).toBeUndefined();
    expect(grid?.get('struct', 8 + 12, 8 + 6)).not.toBe(0);
    expect(w.sim.sector.grid.get('struct', 8 + 4, 8 + 4)).toBe(0);
  });
});
