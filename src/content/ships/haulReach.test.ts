import { describe, expect, it } from 'vitest';
import { CrewC, newGame, playerShip, storageCount } from '../../sim';
import { JobC, PositionC } from '../../sim/crew/components';
import { AllegianceC } from '../../sim/fight/components';
import { CarryingC, ItemStackC } from '../../sim/items/components';
import { spillItems } from '../../sim/items/stacks';
import { shipStorages } from '../../sim/items/stock';
import { shipGrid } from '../../sim/regions';
import type { Sim } from '../../sim/sim';
import { Struct } from '../../sim/structure';
import { content } from '../index';

const ITEM = 'item.metal';

/** Wall every open floor tile beside the ship's storage modules; returns the undo. */
function wallOffStorage(sim: Sim, ship: number): () => void {
  const grid = shipGrid(sim, ship)!;
  const stores = new Set(shipStorages(sim, ship));
  const walled: [number, number, number][] = [];
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (!stores.has(grid.get('module', x, y))) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (!grid.inBounds(nx, ny) || grid.get('module', nx, ny) !== 0) continue;
          const s = grid.get('struct', nx, ny);
          if (s !== Struct.Floor && s !== Struct.Door) continue;
          walled.push([nx, ny, s]);
          grid.set('struct', nx, ny, Struct.Wall);
        }
      }
    }
  }
  return () => {
    for (const [x, y, s] of walled) grid.set('struct', x, y, s);
  };
}

/** Haul jobs carrying ITEM off the floor. */
const floorHauls = (sim: Sim): number[] =>
  sim.world.query(JobC).filter((id) => {
    const h = sim.world.get(id, JobC)?.haul;
    return h?.item === ITEM && h.src.kind === 'floor';
  });

describe('hauling to storage the crew cannot reach (#476)', () => {
  it('leaves the stack where it lies while storage is walled off, and hauls it once it opens', () => {
    const sim = newGame(7, content);
    for (let i = 0; i < 5; i++) sim.step();
    const ship = playerShip(sim);
    const reopen = wallOffStorage(sim, ship);
    const crew = sim.world.query(CrewC).find((i) => sim.world.get(i, AllegianceC)?.faction === 'player') as number;
    const at = sim.world.get(crew, PositionC)!;
    const stored = (): number => shipStorages(sim, ship).reduce((n, id) => n + storageCount(sim, id, ITEM), 0);
    const before = stored();
    expect(spillItems(sim, ship, at.toX, at.toY, ITEM, 5)).toBe(0);
    const stacks = (): number[] => sim.world.query(ItemStackC).filter((id) => sim.world.get(id, ItemStackC)?.item === ITEM);
    const [stack] = stacks();
    expect(stack).toBeDefined();

    const seen = new Set<number>();
    let lifted = 0;
    for (let i = 0; i < 600; i++) {
      sim.step();
      for (const j of floorHauls(sim)) seen.add(j);
      for (const c of sim.world.query(CarryingC)) if (sim.world.get(c, CarryingC)?.item === ITEM) lifted++;
    }
    expect(seen.size).toBe(0); // no haul is planned to storage nobody can get to
    expect(lifted).toBe(0);
    expect(stacks()).toEqual([stack]); // the stack lies where it was dropped, untouched
    expect(sim.world.get(stack!, ItemStackC)?.count).toBe(5);

    reopen();
    for (let i = 0; i < 1500 && stored() < before + 5; i++) sim.step();
    expect(stored()).toBe(before + 5);
    expect(stacks()).toEqual([]);
  });

  it('a hauler whose storage is walled off after the haul was planned leaves the stack where it lies', () => {
    const sim = newGame(7, content);
    for (let i = 0; i < 5; i++) sim.step();
    const ship = playerShip(sim);
    const crew = sim.world.query(CrewC).find((i) => sim.world.get(i, AllegianceC)?.faction === 'player') as number;
    const at = sim.world.get(crew, PositionC)!;
    expect(spillItems(sim, ship, at.toX, at.toY, ITEM, 5)).toBe(0);
    for (let i = 0; i < 40 && floorHauls(sim).length === 0; i++) sim.step();
    expect(floorHauls(sim).length).toBe(1);
    wallOffStorage(sim, ship);
    const seen = new Set<number>(floorHauls(sim));
    let lifted = 0;
    for (let i = 0; i < 300; i++) {
      sim.step();
      for (const j of floorHauls(sim)) seen.add(j);
      for (const c of sim.world.query(CarryingC)) if (sim.world.get(c, CarryingC)?.item === ITEM) lifted++;
    }
    expect(lifted).toBe(0);
    expect(seen.size).toBe(1); // the planned haul ended at the stack; no new one
    const stack = sim.world.query(ItemStackC).find((id) => sim.world.get(id, ItemStackC)?.item === ITEM);
    expect(sim.world.get(stack!, ItemStackC)?.count).toBe(5);
  });
});
