import { describe, expect, it } from 'vitest';
import { airlockOf, crew, world } from '../eva/airFixture';
import { shuttle } from '../eva/airFixture';
import { airlockTiles } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { SuitC } from '../eva/components';
import { suitDef } from '../eva/suit';
import { stat } from '../stats';
import { TICK_HZ } from '../time';
import { VehicleC } from '../vehicles/components';
import { flightTicks, floatTicks, travelTicks } from './travel';

/** Ticks per tile for this walker: the species speed less the dark of an unlit test ship. */
const perTile = (sim: ReturnType<typeof world>, c: number): number => TICK_HZ / stat(sim, c, 'moveSpeed');
const row = (n: number, y = 4): { x: number; y: number }[] => Array.from({ length: n }, (_, i) => ({ x: 5 + i, y }));

describe('travel time', () => {
  it('walks a tile in TICK_HZ / moveSpeed ticks, a diagonal in sqrt 2 times that', () => {
    const sim = world();
    const c = crew(sim, 4, 4);
    expect(travelTicks(sim, c, row(5))).toBe(Math.round(5 * perTile(sim, c)));
    expect(travelTicks(sim, c, [{ x: 5, y: 5 }])).toBe(Math.round(perTile(sim, c) * Math.SQRT2));
    expect(travelTicks(sim, c, [])).toBe(0);
  });

  it('a suit slows the walk by its move multiplier, and `suited` prices a suit not yet worn', () => {
    const sim = world();
    const c = crew(sim, 4, 4);
    const bare = travelTicks(sim, c, row(10));
    const priced = travelTicks(sim, c, row(10), { suited: true });
    expect(priced).toBe(Math.round(bare / suitDef(sim).moveMult));
    sim.world.add(c, SuitC, { worn: true });
    expect(travelTicks(sim, c, row(10))).toBe(priced);
  });

  it('crossing an airlock costs one cycle, whichever door the walk lands on first', () => {
    const sim = world();
    const lock = airlockOf(sim);
    const m = sim.world.get(lock, ModuleC)!;
    const t = airlockTiles(sim.content.modules[m.def]!, m);
    const c = crew(sim, t.inside.x, t.inside.y);
    const through = [t.inner, t.outer];
    expect(travelTicks(sim, c, through)).toBe(Math.round(2 * perTile(sim, c) + 2 * TICK_HZ)); // two tiles and a 2 s cycle
    expect(travelTicks(sim, c, [t.inner])).toBe(Math.round(perTile(sim, c))); // the inner door alone is no crossing
  });

  it('a float is distance over the float speed, a flight distance over the shuttle speed plus the dock time', () => {
    const sim = world();
    expect(floatTicks(sim, 3)).toBe(Math.round((3 / suitDef(sim).floatSpeed) * TICK_HZ));
    const v = sim.world.get(shuttle(sim), VehicleC)!;
    expect(flightTicks(sim, v, 80)).toBe(80 / (8 / TICK_HZ) + 6 * TICK_HZ); // 8 tiles/s: 10 s, plus 6 s
    expect(flightTicks(sim, { ...v, def: 'nope' }, 80)).toBe(Infinity);
  });

  it('is deterministic: the same walk gives the same ticks', () => {
    const sim = world();
    const c = crew(sim, 4, 4);
    expect(travelTicks(sim, c, row(7, 5))).toBe(travelTicks(sim, c, row(7, 5)));
  });
});
