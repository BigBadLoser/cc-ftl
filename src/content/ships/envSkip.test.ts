import { describe, expect, it, vi } from 'vitest';
import {
  deserialize, homeShip, ModuleC, newGame, removeModule, serialize, shipGrid, shipIdAt, Struct, type Module, type ShipTemplate, type Sim,
} from '../../sim';
import { stampShip } from '../../sim/combat/ships';
import { ShipGrid } from '../../sim/shipGrid';
import { spawnStation } from '../../sim/stations/spawn';
import { content } from '../index';

/**
 * The environment solvers (atmosphere, temperature, smoke, lighting) skip regions whose inputs are unchanged since a solve
 * that changed nothing, and reuse cached link lists, conductance and lamp light. Those caches hang off the grid objects, so a
 * sim rebuilt from its save every tick never has a warm one: it does every solve in full. Both runs must stay byte-identical
 * (grids, components, rng) through a scripted scenario that touches every input. Each edit lands on its own inert prize
 * (no crew, no modules), whose fields have settled, so the edit meets a solver that is skipping.
 */

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
type At = { x: number; y: number };

/** The first tile of a ship (in its rectangle, row-major) matching `test`, or undefined. */
function findTile(sim: Sim, ship: number, test: (x: number, y: number) => boolean): At | undefined {
  const g = shipGrid(sim, ship);
  if (!g) return undefined;
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (test(x, y)) return { x, y };
  return undefined;
}

const beside = (sim: Sim, at: At, kind: number): boolean =>
  SIDES.some(([dx, dy]) => sim.sector.grid.get('struct', at.x + dx, at.y + dy) === kind);

/** The ship's first door, the room beside it, and a hull wall that breaching opens a room to Space. */
function landmarks(sim: Sim, ship: number): { door: At; room: number; roomTile: At; hull: At } {
  const s = sim.sector.grid;
  const door = findTile(sim, ship, (x, y) => s.get('struct', x, y) === Struct.Door);
  const hull = findTile(sim, ship, (x, y) => s.get('struct', x, y) === Struct.Wall && beside(sim, { x, y }, Struct.Space) && beside(sim, { x, y }, Struct.Floor));
  if (!door || !hull) throw new Error('fixture: no door or hull wall');
  const roomTile = SIDES.map(([dx, dy]) => ({ x: door.x + dx, y: door.y + dy })).find((p) => s.get('room', p.x, p.y) !== 0);
  if (!roomTile) throw new Error('fixture: no room beside the door');
  return { door, room: s.get('room', roomTile.x, roomTile.y), roomTile, hull };
}

/** A starter hull as an inert prize at sector x, with its modules removed. */
function inertPrize(sim: Sim, x: number): number {
  const prize = stampShip(sim, content.ships['ship.starter'] as ShipTemplate, { faction: 'hostile', x, y: 60, state: 'prize' });
  for (const id of [...sim.world.query(ModuleC)]) {
    const m = sim.world.get(id, ModuleC) as Module;
    if (shipIdAt(sim, m.x, m.y) === prize) removeModule(sim, id);
  }
  return prize;
}

/** The home ship, and the prizes for: a door (beside thin air), a breach, smoke then a door, a fire. */
interface Cast {
  home: number;
  door: number;
  breach: number;
  smoke: number;
  fire: number;
}

/** The scripted edits, applied identically to both runs at the start of a tick (by tick number). */
function script(sim: Sim, cast: Cast): void {
  const s = sim.sector.grid;
  const t = sim.tick;
  const setDoor = (ship: number, open: boolean): void => {
    const { door } = landmarks(sim, ship);
    s.set('door', door.x, door.y, open ? 255 : 0);
  };
  if (t === 30) {
    setDoor(cast.door, true);
    const { hull } = landmarks(sim, cast.breach);
    s.set('struct', hull.x, hull.y, Struct.Space);
    // A smoke puff beside the smoke prize's door, which stays shut for now.
    const { roomTile } = landmarks(sim, cast.smoke);
    s.set('smoke', roomTile.x, roomTile.y, 200);
    const f = findTile(sim, cast.fire, (x, y) => s.get('struct', x, y) === Struct.Floor && s.get('room', x, y) !== 0) as At;
    s.set('fire', f.x, f.y, 200);
  }
  if (t === 75) setDoor(cast.smoke, true);
  if (t === 100) setDoor(cast.door, false);
  if (t === 140) setDoor(cast.door, true);
  if (t === 120) {
    // Power cut on the home ship: every power source wrecked; one light removed outright.
    for (const id of [...sim.world.query(ModuleC)]) {
      const m = sim.world.get(id, ModuleC) as Module;
      if ((sim.content.modules[m.def]?.power ?? 0) > 0 && shipIdAt(sim, m.x, m.y) === cast.home) m.hp = 0;
    }
    const lamp = [...sim.world.query(ModuleC)].find((id) => sim.content.modules[(sim.world.get(id, ModuleC) as Module).def]?.light);
    if (lamp !== undefined) removeModule(sim, lamp);
  }
}

describe('environment solver skipping', () => {
  it('gives exactly the full solve, tick by tick, through doors, a breach, smoke, a fire and a power cut', () => {
    const warm = newGame(7, content);
    expect(typeof spawnStation(warm, Object.keys(content.stations ?? {})[0] as string, 'outpost', 3)).toBe('number');
    const cast: Cast = {
      home: homeShip(warm), door: inertPrize(warm, 300), breach: inertPrize(warm, 400), smoke: inertPrize(warm, 500), fire: inertPrize(warm, 600),
    };
    warm.step();
    // Thin air in the room beside the door prize's door, so opening it moves gas.
    const { room } = landmarks(warm, cast.door);
    findTile(warm, cast.door, (x, y) => {
      if (warm.sector.grid.get('room', x, y) === room) warm.sector.grid.set('o2', x, y, 2);
      return false;
    });
    let cold = deserialize(serialize(warm), content);
    const loads = { warm: 0, cold: 0 };
    let counting: keyof typeof loads | null = null;
    const load = ShipGrid.prototype.load;
    const spy = vi.spyOn(ShipGrid.prototype, 'load').mockImplementation(function (this: ShipGrid, field, rect) {
      if (counting && field === 'o2') loads[counting]++;
      return load.call(this, field, rect);
    });
    for (let i = 0; i < 170; i++) {
      script(warm, cast);
      script(cold, cast);
      counting = 'warm';
      warm.step();
      counting = 'cold';
      cold.step();
      counting = null;
      expect(serialize(warm) === serialize(cold), `tick ${warm.tick}`).toBe(true);
      // Rebuild the cold run from its own save: fresh grid objects, so no solver cache survives into the next tick.
      cold = deserialize(serialize(cold), content);
    }
    spy.mockRestore();
    // The warm run really skipped solves (fewer atmosphere loads), so the equality above covers the skips.
    expect(loads.warm).toBeLessThan(loads.cold);
  });
});
