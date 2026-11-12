import { describe, expect, it } from 'vitest';
import { commit, fresh, live, redo, undo } from './history';
import {
  addModule, addRoom, deleteRoom, hullOf, moveModule, newModule, paint, removeModule, stroke, resizeRoom, roomRect, rotateModule, setRole, splitRoom, toTemplate,
  type Layout, type Tile,
} from './layout';
import { designFromLayout, labelSpot } from './design';
import { problemsOf } from './problems';
import { buildLayout, DEFAULT_SOURCE } from './source';
import { placementProblem } from './world';

const blank = (w = 24, h = 18): Layout => ({
  name: 'test', width: w, height: h, cells: Array.from({ length: h }, () => '.'.repeat(w)), roomOf: new Array<number>(w * h).fill(-1), rooms: [], modules: [], moduleIds: [], nextModuleId: 0, extra: {}, immobile: true,
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
  it('floor painted out beside a convex corner frees only hull with no space among its eight neighbours', () => {
    const { layout, id } = addRoom(blank(), { x: 5, y: 5, w: 6, h: 6 }, 'cargo');
    // the room's east hull is x = 11, y = 4..11; the block covers y = 5..8 beside it
    const out = paint(layout, rect(12, 5, 4, 4), '_', id);
    for (const y of [6, 7]) expect(out.cells[y]?.[11]).toBe('_');
    // (11, 5) and (11, 8) have open space diagonally (12, 4) and (12, 9): they stay hull
    for (const y of [4, 5, 8, 9]) expect(out.cells[y]?.[11]).toBe('#');
  });
  it('a stroke painted whole frees the same hull however it is split, so no tile is left behind', () => {
    const { layout, id } = addRoom(blank(), { x: 5, y: 5, w: 6, h: 6 }, 'cargo');
    const tiles = rect(12, 5, 4, 4);
    const whole = paint(layout, tiles, '_', id);
    // the lab repaints from the stroke's start with all tiles so far: the last step equals one paint of everything
    let acc: Tile[] = [];
    let last = layout;
    for (const t of tiles) { acc = [...acc, t]; last = paint(layout, acc, '_', id); }
    expect(last).toEqual(whole);
    // painting tile by tile on each result (the old way) strands hull tiles that were not yet sealed when the tile above them was painted
    let stepwise = layout;
    for (const t of tiles) stepwise = paint(stepwise, [t], '_', id);
    expect(stepwise.cells.join('').split('#').length).toBeGreaterThanOrEqual(whole.cells.join('').split('#').length);
  });
  it('painting floor never drops a module', () => {
    const { layout } = buildLayout({ ...DEFAULT_SOURCE, kind: 'starter', id: 'ship.wayfarer' });
    const out = paint(layout, rect(36, 7, 7, 7), '_');
    expect(out.modules).toEqual(layout.modules);
  });
  it('derives hull around holes too, corners included (8 neighbours, #430)', () => {
    let l = paint(blank(), rect(3, 3, 10, 9), '_');
    l = paint(l, rect(7, 6, 2, 2), '.');
    const r = rows(l);
    expect(r[5]?.slice(6, 10)).toBe('####');
    expect(r[6]?.slice(6, 10)).toBe('#..#');
    expect(r[8]?.slice(6, 10)).toBe('####');
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

describe('preview restamp and drones', () => {
  it('moving a drone bay and restamping leaves exactly one drone, owned by the new ship', async () => {
    const { DroneC } = await import('../../src/sim/drones/components');
    const { buildWorld, restamp } = await import('./world');
    const bay = { def: 'module.droneBay', x: 6, y: 6, rot: 0, drones: ['drone.defence'] };
    const a = addModule(paint(blank(), rect(4, 4, 8, 6), '_'), bay);
    const w = buildWorld(a);
    expect(w).not.toBeNull();
    if (!w) return;
    expect(w.sim.world.query(DroneC)).toHaveLength(1);
    const b = moveModule(a, 0, 8, 6, 0);
    const ship = restamp(w.sim, w.ship, b);
    expect(ship).not.toBeNull();
    const drones = w.sim.world.query(DroneC);
    expect(drones).toHaveLength(1);
    expect(w.sim.world.get(drones[0] as number, DroneC)?.ship).toBe(ship);
  });
});

describe('room name placement', () => {
  const room = (): { layout: Layout; id: number } => addRoom(blank(), { x: 5, y: 5, w: 10, h: 6 }, 'cargo');
  const cover = (l: Layout, x0: number, y0: number, w: number, h: number): Set<number> => new Set(rect(x0, y0, w, h).map(([x, y]) => y * l.width + x));
  it('sits at the middle when nothing covers it', () => {
    const { layout, id } = room();
    const s = labelSpot(layout, id, new Set(), 5, 9.5, 7.5);
    expect(Math.abs(s.x - 9.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(s.y - 7.5)).toBeLessThanOrEqual(1);
  });
  it('never lands on a module, and takes the larger free patch', () => {
    const { layout, id } = room();
    const covered = cover(layout, 7, 5, 2, 6); // a wall of furniture splits the room: 2 columns left, 6 right
    const s = labelSpot(layout, id, covered, 5, 9.5, 7.5);
    expect(covered.has(Math.round(s.y) * layout.width + Math.round(s.x))).toBe(false);
    expect(s.x).toBeGreaterThan(9);
  });
  it('goes along the top edge when the floor is covered', () => {
    const { layout, id } = room();
    const s = labelSpot(layout, id, cover(layout, 5, 5, 10, 6), 5, 9.5, 7.5);
    expect(s.y).toBe(5);
    expect(s.x).toBeCloseTo(9.5, 6);
  });
  it('is computed on the design (rooms carry their spot)', () => {
    const { layout, id } = room();
    const d = designFromLayout(layout, 't');
    expect(d.rooms[id]).toMatchObject({ lx: expect.any(Number), ly: expect.any(Number) });
  });
});

describe('placing twice in the same spot', () => {
  it('the second placement is refused against the layout as it is now', () => {
    const { layout } = addRoom(blank(), { x: 5, y: 5, w: 10, h: 8 }, 'cargo');
    expect(placementProblem(layout, 'module.chair', 7, 7, 0)).toBeNull();
    const placed = addModule(layout, { def: 'module.chair', x: 7, y: 7, rot: 0 });
    expect(placementProblem(placed, 'module.chair', 7, 7, 0)).not.toBeNull();
  });
});

describe('placement of containers', () => {
  // a frame: a strip of Beam tiles with a hull floor beside it
  const frame = (): Layout => {
    const l = blank(30, 24);
    return { ...l, cells: l.cells.map((r, y) => (y >= 8 && y <= 13 ? `${r.slice(0, 5)}${'='.repeat(10)}${r.slice(15)}` : y === 14 ? `${r.slice(0, 5)}${'#'.repeat(10)}${r.slice(15)}` : r)) };
  };
  it('stands on the frame, clamped by a short end, and moves along it', () => {
    const l = frame();
    // 2x4 at rot 0 is 2 wide, 4 tall: its north end clamps to the frame row above
    expect(placementProblem(l, 'container.2x4', 6, 9, 0)).toBeNull();
    expect(placementProblem(l, 'container.2x4', 9, 9, 0)).toBeNull();
    expect(placementProblem(l, 'container.2x4', 6, 8, 0)).toMatch(/clamped/); // nothing above it
  });
  it('is refused off the frame', () => {
    const l = frame();
    expect(placementProblem(l, 'container.2x4', 20, 9, 0)).toMatch(/frame/);
  });
  it('a plain-floor spot is refused (the ordinary floor rule is not the container rule)', () => {
    const l = paint(frame(), [20, 21].flatMap((x): [number, number][] => [8, 9, 10, 11, 12].map((y) => [x, y])), '_');
    expect(placementProblem(l, 'container.2x4', 20, 9, 0)).not.toBeNull();
  });
});

describe('container clamp turns with the module', () => {
  const lay = (): Layout => addModule(blank(30, 24), { def: 'container.2x4', x: 6, y: 9, rot: 0 });
  it('a quarter turn and a drag-turn both turn the clamp side', () => {
    expect(rotateModule(lay(), 0).modules[0]?.clamp).toBe('e');
    expect(moveModule(lay(), 0, 6, 9, 2).modules[0]?.clamp).toBe('s');
    expect(moveModule(addModule(blank(), { def: 'module.chair', x: 3, y: 3, rot: 0 }), 0, 3, 3, 1).modules[0]?.clamp).toBeUndefined();
  });
  it('the placement candidate for a turned container uses the turned clamp', () => {
    const frame: Layout = { ...lay(), cells: lay().cells.map((r, y) => (y >= 8 && y <= 13 ? `${r.slice(0, 5)}${'='.repeat(10)}#${r.slice(16)}` : r)) };
    expect(placementProblem(frame, 'container.2x4', 6, 9, 1, 0)).toBeNull(); // east end against the hull column
    expect(placementProblem(frame, 'container.2x4', 6, 9, 0, 0)).toBeNull();
  });
});

describe('a new container turned before it is placed', () => {
  const frame = (): Layout => { const l = blank(30, 24); return { ...l, cells: l.cells.map((r, y) => (y >= 8 && y <= 13 ? `${r.slice(0, 5)}${'='.repeat(10)}#${r.slice(16)}` : r)) }; };
  it('gets the clamp end for its turn, so a quarter-turned container can be placed against the east hull', () => {
    expect(newModule('container.2x4', 6, 9, 1).clamp).toBe('e');
    expect(newModule('container.2x4', 6, 9, 3).clamp).toBe('w');
    expect(newModule('module.chair', 6, 9, 1).clamp).toBeUndefined();
    expect(placementProblem(frame(), 'container.2x4', 6, 9, 1)).toBeNull();
  });
});

describe('beam painting', () => {
  it('paints, erases and undoes like the other paint tools, and the validator judges the frame', () => {
    const l = blank(30, 24);
    const framed = paint(l, [[5, 5], [6, 5], [7, 5]], '=');
    expect(framed.cells[5]?.slice(5, 8)).toBe('===');
    expect(framed.roomOf[5 * 30 + 5]).toBe(-1);
    expect(paint(framed, [[6, 5]], '.').cells[5]?.slice(5, 8)).toBe('=.=');
    expect(paint(framed, [[5, 5]], '=')).toBe(framed); // nothing changes: no undo step
    const withBox = addModule(paint(l, rect(6, 9, 2, 4), '='), { def: 'container.2x4', x: 6, y: 9, rot: 0 });
    const over = paint(withBox, [[6, 9]], '=');
    expect(over).toBe(withBox);
  });
});

describe('generated designs are stamped the way the game spawns them', () => {
  it('a faction ship carries its generator faction, seed, depth, role and side, so the renderer picks its livery', async () => {
    const { ShipC } = await import('../../src/sim/combat/components');
    const { worldOf } = await import('./world');
    const { layout } = buildLayout({ ...DEFAULT_SOURCE, kind: 'faction', id: 'faction.civilian', family: 'freighter', seed: 1, depth: 2 });
    expect(layout.origin?.gen).toMatchObject({ faction: 'faction.civilian', seed: 1, depth: 2 });
    const w = worldOf(layout);
    const ship = w?.sim.world.get(w.ship, ShipC);
    expect(ship?.gen).toMatchObject({ faction: 'faction.civilian', seed: 1, depth: 2 });
    expect(ship?.faction).toBe(layout.origin?.side);
  });
  it('a blank grid is a plain player ship', async () => {
    const { ShipC } = await import('../../src/sim/combat/components');
    const { worldOf } = await import('./world');
    const w = worldOf(paint(blank(), rect(4, 4, 5, 5), '_'));
    expect(w?.sim.world.get(w.ship, ShipC)).toMatchObject({ faction: 'player' });
    expect(w?.sim.world.get(w.ship, ShipC)?.gen).toBeUndefined();
  });
});

describe('a room holds floor only (#464)', () => {
  it('drawn across an existing wall, door and beam it leaves them as they are and gives them no room', () => {
    let l = blank();
    for (const [x, y, c] of [[7, 6, '#'], [7, 7, 'D'], [7, 8, '=']] as const) l = paint(l, [[x, y]], c);
    const { layout, id } = addRoom(l, { x: 5, y: 5, w: 6, h: 5 }, 'cargo');
    expect([layout.cells[6]?.[7], layout.cells[7]?.[7], layout.cells[8]?.[7]]).toEqual(['#', 'D', '=']);
    for (const y of [6, 7, 8]) expect(layout.roomOf[y * layout.width + 7]).toBe(-1);
    for (let i = 0; i < layout.roomOf.length; i++) if (layout.roomOf[i] === id) expect(layout.cells[Math.floor(i / layout.width)]?.[i % layout.width]).toBe('_');
  });
  it('resizing a room over a wall does not turn the wall into room floor', () => {
    const { layout, id } = addRoom(blank(), { x: 5, y: 5, w: 4, h: 4 }, 'cargo');
    const wide = resizeRoom(layout, id, { x: 5, y: 5, w: 6, h: 4 }); // the ring wall at x=9 is inside the new rectangle
    expect(wide.cells[6]?.[9]).toBe('_');
    const walled = paint(layout, [[10, 6]], '#');
    const over = resizeRoom(walled, id, { x: 5, y: 5, w: 6, h: 4 });
    expect(over.cells[6]?.[10]).toBe('#');
    expect(over.roomOf[6 * over.width + 10]).toBe(-1);
  });
});

describe('right-click erases what the tool paints (#464)', () => {
  const t = (...p: Tile[]): Tile[] => p;
  it('floor goes to space, wall and door to floor, beam to space, space lays floor; other kinds are left', () => {
    const { layout } = addRoom(blank(), { x: 5, y: 5, w: 4, h: 4 }, 'cargo');
    expect(stroke(layout, 'floor', true, t([6, 6])).cells[6]?.[6]).toBe('.');
    expect(stroke(layout, 'floor', true, t([4, 4])).cells[4]?.[4]).toBe('#'); // a wall is not floor
    expect(stroke(layout, 'wall', true, t([4, 6])).cells[6]?.[4]).toBe('_');
    expect(stroke(paint(layout, [[6, 6]], 'D'), 'door', true, t([6, 6])).cells[6]?.[6]).toBe('_');
    expect(stroke(paint(layout, [[2, 2]], '='), 'beam', true, t([2, 2])).cells[2]?.[2]).toBe('.');
    expect(stroke(layout, 'space', true, t([1, 1])).cells[1]?.[1]).toBe('_');
  });
  it('room unassigns floor and keeps it; module removes the module under the pointer', () => {
    const made = addRoom(blank(), { x: 5, y: 5, w: 6, h: 6 }, 'support');
    const id = made.id;
    const layout = addModule(made.layout, { def: 'module.chair', x: 6, y: 6, rot: 0 });
    const un = stroke(layout, 'room', true, t([8, 8]));
    expect(un.cells[8]?.[8]).toBe('_');
    expect(un.roomOf[8 * un.width + 8]).toBe(-1);
    expect(un.roomOf[9 * un.width + 8]).toBe(id);
    expect(stroke(layout, 'module', true, t([9, 9]))).toBe(layout);
    const gone = stroke(layout, 'module', true, t([6, 6]));
    expect(gone.modules).toHaveLength(0);
    expect(gone.moduleIds).toHaveLength(0);
  });
});
