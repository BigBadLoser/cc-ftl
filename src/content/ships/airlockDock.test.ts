import { describe, expect, it } from 'vitest';
import {
  CarryingC, boardingTile, newGame, ModuleC, PositionC, Sim, Struct, StorageC, shipOf, VehicleC, airlockTiles, cargoCount, cargoTile, dockPoint, findPath,
  footprintTiles, gridFromTemplate, hullOutward, hullRow, hullSide, inFootprint, isTileWalkable, keepOutTiles, placementError,
  spawnModule, storageCount, type ModuleDef,
} from '../../sim';
import { content } from '../index';
import { PLAYER_START as P0 } from '../../sim/tuning'; // the player ship's sector top-left

const def = content.modules['module.airlock'] as ModuleDef;
const at = { x: 6, y: 6 };

/** A 12x12 ship: hull ring, floor inside, Space around. Each rotation gets its own side of the hull. */
function ring(): Sim {
  const rows = ['.'.repeat(14)];
  rows.push('.' + '#'.repeat(12) + '.');
  for (let i = 0; i < 10; i++) rows.push('.#' + '_'.repeat(10) + '#.');
  rows.push('.' + '#'.repeat(12) + '.');
  rows.push('.'.repeat(14));
  const sim = new Sim(1, content);
  sim.grids.set(1, gridFromTemplate(1, { name: 'ring', rows }));
  return sim;
}

/** Every anchor where the airlock can be placed at a rotation. */
function placements(sim: Sim, rot: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (placementError(sim, 1, 'module.airlock', x, y, rot) === null) out.push({ x, y });
  return out;
}

describe('airlock footprint', () => {
  it('is 3 wide, hull row plus 3 inboard, with a collar outside the footprint', () => {
    expect(def.footprint).toEqual([3, 4]);
    for (let rot = 0; rot < 4; rot++) {
      const t = airlockTiles(def, { ...at, rot });
      const tiles = footprintTiles(def, at.x, at.y, rot);
      expect(tiles).toHaveLength(12);
      const out = hullOutward(hullSide(def, rot) ?? 'n');
      // The hull row is the footprint side on the hull line; the outer door is its middle tile.
      const row = hullRow(def, at.x, at.y, rot);
      expect(row).toHaveLength(3);
      expect(row).toContainEqual(t.outer);
      // Collar: one tile beyond the hull tile, outside the footprint; the inner door and inside tile follow inboard.
      expect(t.collar).toEqual({ x: t.outer.x + out.x, y: t.outer.y + out.y });
      expect(inFootprint(def, at.x, at.y, rot, t.collar!.x, t.collar!.y)).toBe(false);
      expect(t.inner).toEqual({ x: t.outer.x - out.x, y: t.outer.y - out.y });
      expect(t.inside).toEqual({ x: t.outer.x - 2 * out.x, y: t.outer.y - 2 * out.y });
      // Two unloaders, a hull tile either side of the middle, with the keep-out tile in front of each chute.
      expect(t.unloaders).toHaveLength(2);
      for (const u of t.unloaders) {
        expect(u.tiles).toHaveLength(2);
        expect(u.tiles).toContainEqual(u.chute);
        expect(u.stand).toEqual({ x: u.chute.x - out.x, y: u.chute.y - out.y });
        for (const p of [...u.tiles, u.stand]) expect(inFootprint(def, at.x, at.y, rot, p.x, p.y)).toBe(true);
      }
      expect(keepOutTiles(def, { ...at, rot })).toEqual(t.unloaders.map((u) => u.stand));
    }
  });

  it('places on every hull side with the collar in Space beyond the hull, and turns the right tiles to doors', () => {
    for (let rot = 0; rot < 4; rot++) {
      const sim = ring();
      const spots = placements(sim, rot);
      expect(spots.length).toBeGreaterThan(0);
      const { x, y } = spots[Math.floor(spots.length / 2)] as { x: number; y: number };
      const id = spawnModule(sim, 1, 'module.airlock', x, y, rot);
      const m = sim.world.get(id, ModuleC)!;
      const t = airlockTiles(def, m);
      const grid = sim.grids.get(1)!;
      const collar = t.collar!;
      expect(grid.get('struct', collar.x, collar.y)).toBe(Struct.Space);
      expect(grid.get('module', collar.x, collar.y)).toBe(0);
      expect(grid.get('struct', t.outer.x, t.outer.y)).toBe(Struct.Door);
      expect(grid.get('struct', t.inner.x, t.inner.y)).toBe(Struct.Door);
      for (const w of hullRow(def, x, y, rot).filter((p) => p.x !== t.outer.x || p.y !== t.outer.y)) {
        expect(grid.get('struct', w.x, w.y)).toBe(Struct.Wall); // the plain hull either side stays wall
      }
    }
  });

  it('keeps the walk zone and keep-out tiles walkable, the unloaders solid, and every walkable tile reachable', () => {
    for (let rot = 0; rot < 4; rot++) {
      const sim = ring();
      const spots = placements(sim, rot);
      const { x, y } = spots[Math.floor(spots.length / 2)] as { x: number; y: number };
      const id = spawnModule(sim, 1, 'module.airlock', x, y, rot);
      const t = airlockTiles(def, sim.world.get(id, ModuleC)!);
      const grid = sim.grids.get(1)!;
      for (const p of [t.inside, ...keepOutTiles(def, sim.world.get(id, ModuleC)!)]) expect(isTileWalkable(sim, grid, p.x, p.y)).toBe(true);
      for (const u of t.unloaders) for (const p of u.tiles) expect(isTileWalkable(sim, grid, p.x, p.y)).toBe(false);
      // From the middle of the room crew can walk to the inside tile, both keep-out tiles and the inner door.
      const room = { x: 7, y: 7 };
      for (const goal of [t.inside, t.inner, ...t.unloaders.map((u) => u.stand)]) {
        const path = findPath(sim, 1, room, goal);
        expect(path, `rot ${rot} to ${goal.x},${goal.y}`).not.toBeNull();
      }
    }
  });

  it('blocks building on the keep-out tiles and the rest of the footprint', () => {
    for (let rot = 0; rot < 4; rot++) {
      const sim = ring();
      const spots = placements(sim, rot);
      const { x, y } = spots[Math.floor(spots.length / 2)] as { x: number; y: number };
      const id = spawnModule(sim, 1, 'module.airlock', x, y, rot);
      for (const p of keepOutTiles(def, sim.world.get(id, ModuleC)!)) {
        expect(placementError(sim, 1, 'module.light', p.x, p.y, 0)).toBe('occupied');
        expect(placementError(sim, 1, 'module.storage', p.x, p.y, 0)).toBe('occupied');
      }
      const t = airlockTiles(def, sim.world.get(id, ModuleC)!);
      expect(placementError(sim, 1, 'module.light', t.inside.x, t.inside.y, 0)).toBe('occupied');
      // Another airlock cannot overlap the first one's keep-out tiles either.
      const overlapping = placements(sim, rot).filter((s) => footprintTiles(def, s.x, s.y, rot).some((p) => keepOutTiles(def, sim.world.get(id, ModuleC)!).some((k) => k.x === p.x && k.y === p.y)));
      expect(overlapping).toEqual([]);
    }
  });
});

describe('starter ship airlock', () => {
  it('fits, with its collar outside the west hull', () => {
    const sim = newGame(1, content);
    const id = sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)!.gridId === 1 && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;
    const t = airlockTiles(def, sim.world.get(id, ModuleC)!);
    expect(t.collar).toEqual({ x: P0.x + 0, y: P0.y + 10 });
    expect(t.outer).toEqual({ x: P0.x + 1, y: P0.y + 10 });
    expect(t.inside).toEqual({ x: P0.x + 3, y: P0.y + 10 });
    expect(sim.grids.get(1)!.get('struct', P0.x + 0, P0.y + 10)).toBe(Struct.Space);
    // The dock point is the collar tile's centre, in sector tiles.
    const ship = shipOf(sim, 1)!;
    expect(dockPoint(sim, id)).toMatchObject({ gridId: 1, x: ship.x + 0.5, y: ship.y + 10.5, inside: t.inside });
  });
});

describe('cargo through the unloaders', () => {
  it('a docked shuttle is unloaded at the keep-out tiles and the crew haul it to storage', () => {
    const sim = newGame(1, content);
    const airlock = sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)!.gridId === 1 && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;
    const shuttle = sim.world.query(VehicleC)[0] as number;
    const v = sim.world.get(shuttle, VehicleC)!;
    const p = dockPoint(sim, airlock)!;
    Object.assign(v, { state: 'docked', dock: airlock, x: p.x, y: p.y, cargo: [{ item: 'item.parts', count: 6 }] });
    const stands = keepOutTiles(def, sim.world.get(airlock, ModuleC)!);
    const stored = (): number => sim.world.query(StorageC).reduce((n, i) => n + storageCount(sim, i, 'item.parts'), 0);
    const before = stored();
    expect(cargoTile(sim, shuttle)).toMatchObject({ gridId: 1, ...stands[0] });
    // Every pickup from the hold happens with the hauler at a keep-out tile (crew work a job tile from where they stand beside it).
    const pickups = new Set<string>();
    let last = cargoCount(v);
    for (let i = 0; i < 4000 && cargoCount(v) > 0; i++) {
      sim.step();
      const now = cargoCount(v);
      if (now < last) {
        for (const id of sim.world.query(CarryingC)) {
          const pos = sim.world.get(id, PositionC);
          if (pos && sim.world.get(id, CarryingC)?.item === 'item.parts') pickups.add(`${pos.x},${pos.y}`);
        }
      }
      last = now;
    }
    expect(cargoCount(v)).toBe(0);
    expect(pickups.size).toBeGreaterThan(0);
    for (const k of pickups) {
      const [px, py] = k.split(',').map(Number) as [number, number];
      expect(stands.some((t) => Math.max(Math.abs(t.x - px), Math.abs(t.y - py)) <= 1), `pickup at ${k}`).toBe(true);
    }
    for (let i = 0; i < 1500 && stored() < before + 6; i++) sim.step();
    expect(stored()).toBe(before + 6);
  });

  it('hands out the keep-out tile nearest a point, and the boarding tile while stowed', () => {
    const sim = newGame(1, content);
    const airlock = sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)!.gridId === 1 && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;
    const shuttle = sim.world.query(VehicleC)[0] as number;
    const v = sim.world.get(shuttle, VehicleC)!;
    const stands = keepOutTiles(def, sim.world.get(airlock, ModuleC)!);
    expect(cargoTile(sim, shuttle)).toEqual(boardingTile(sim, shuttle)); // stowed in its bay: the bay's boarding tile
    Object.assign(v, { state: 'docked', dock: airlock });
    const [a, b] = stands as [{ x: number; y: number }, { x: number; y: number }];
    expect(cargoTile(sim, shuttle, { x: a.x, y: a.y - 5 })).toMatchObject(a.y < b.y ? a : b);
    expect(cargoTile(sim, shuttle, { x: b.x, y: b.y + 5 })).toMatchObject(a.y < b.y ? b : a);
  });
});
