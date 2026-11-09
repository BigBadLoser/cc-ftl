import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { ammoCount } from '../combat/ammo';
import { StorageC } from '../items/components';
import { ModuleC } from '../modules/components';
import { removeModule, spawnModule } from '../modules/spawn';
import { shipGrid, shipIdOf } from '../regions';
import { Struct, isEvaWalkable } from '../structure';
import { content, ring, world } from './airFixture';
import { nearestExterior } from './shuttle';
import { Sim } from '../sim';

/** The scan `nearestExterior` replaced: every tile of the grid, sorted by distance, then row, then column. */
function scan(sim: ReturnType<typeof world>, ship: number, at: { x: number; y: number }, n: number): { x: number; y: number; d: number }[] {
  const g = shipGrid(sim, ship)!;
  const out: { x: number; y: number; d: number }[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) {
    const k = g.get('struct', x, y);
    if ((k === Struct.Space && isEvaWalkable(g, x, y)) || k === Struct.Ground) out.push({ x, y, d: Math.hypot(x - at.x, y - at.y) });
  }
  return out.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x).slice(0, n);
}

describe('nearest exterior tiles', () => {
  it('match a full scan of the grid, for any point and count, before and after the hull changes', () => {
    const sim = world({ airlock: false });
    const pts = [{ x: -2, y: -2 }, { x: 7, y: 7 }, { x: 6.5, y: 0.5 }, { x: 20, y: 3 }, { x: 0, y: 13 }, { x: 7, y: -1 }];
    const check = (): void => {
      for (const p of pts) for (const n of [0, 1, 3, 40]) expect(nearestExterior(sim, 1, p, n)).toEqual(scan(sim, 1, p, n));
    };
    check();
    shipGrid(sim, 1)!.set('struct', 1, 5, Struct.Space); // a hole in the west hull: new exterior tiles, others gone
    check();
  });
});

describe('ammo count by ship', () => {
  const store = { name: 'Box', asset: 'b', footprint: [1, 1], solid: false, power: 0, flammability: 0, maxHp: 10, buildWork: 10, storage: { capacity: 50 } };
  const scanCount = (sim: Sim, ship: number, item: string): number => {
    let n = 0;
    for (const id of sim.world.query(StorageC)) if (shipIdOf(sim, sim.world.get(id, ModuleC)) === ship) for (const st of sim.world.get(id, StorageC)!.stacks) if (st.item === item) n += st.count;
    return n;
  };
  it('counts what a scan of every storage counts, as storages come and go and ships appear', () => {
    {
      const sim = new Sim(7, { ...content, modules: { ...content.modules, box: store as never } });
      stampShip(sim, { name: 's1', rows: ring() }, { faction: 'player', x: 0, y: 0 });
      const fill = (id: number, count: number): void => void sim.world.get(id, StorageC)!.stacks.push({ item: 'item.x', count });
      const a = spawnModule(sim, 'box', 3, 3, 0);
      fill(a, 4);
      expect(ammoCount(sim, 1, 'item.x')).toBe(4);
      const two = stampShip(sim, { name: 's2', rows: ring() }, { faction: 'neutral', x: 30, y: 0 });
      const b = spawnModule(sim, 'box', 33, 3, 0);
      fill(b, 7);
      for (const ship of [1, two, 0]) expect(ammoCount(sim, ship, 'item.x')).toBe(scanCount(sim, ship, 'item.x'));
      fill(a, 2); // stock changes are read live
      expect(ammoCount(sim, 1, 'item.x')).toBe(6);
      removeModule(sim, a);
      for (const ship of [1, two]) expect(ammoCount(sim, ship, 'item.x')).toBe(scanCount(sim, ship, 'item.x'));
    }
  });
});
