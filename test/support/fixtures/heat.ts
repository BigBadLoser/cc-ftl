/** Shared setup of the heat tests and their slow tier: the starter ship against a raider (weapons off unless asked), settled for a hundred ticks. */
import { CombatC, WeaponC } from '../../../src/sim/combat/components';
import type { SimEvent } from '../../../src/sim/events';
import { ModuleC } from '../../../src/sim/modules/components';
import { newGame } from '../../../src/sim/newGame';
import { shipGrid, shipIds } from '../../../src/sim/regions';
import type { Sim } from '../../../src/sim/sim';
import { content } from '../content';
import { cachedWorld } from '../world';

export interface Fight { sim: Sim; mine: number; foe: number }

/** Starter ship against a raider whose weapons are switched off (so only what a test does moves the meters), after a short settle. */
export function fight(seed = 1, quiet = true): Fight {
  // Built once per file and cloned: the settle is a hundred ticks every case would repeat.
  const sim = cachedWorld(`heat:${seed}:${quiet}`, () => {
    const g = newGame(seed, content);
    g.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
    g.step();
    const foe = shipIds(g)[1] as number;
    if (quiet) for (const id of g.world.query(WeaponC, ModuleC)) if (g.world.get(id, ModuleC)!.x >= 0 && inShip(g, id, foe)) g.world.get(id, ModuleC)!.enabled = false;
    for (let i = 0; i < 100; i++) g.step();
    g.events.drain();
    return g;
  });
  return { sim, mine: shipIds(sim)[0] as number, foe: shipIds(sim)[1] as number };
}

export function inShip(sim: Sim, module: number, ship: number): boolean {
  const g = shipGrid(sim, ship);
  const m = sim.world.get(module, ModuleC)!;
  return !!g && g.inBounds(m.x, m.y);
}

export const combat = (f: Fight, who: 'mine' | 'foe' = 'mine') => sim(f).world.get(f[who], CombatC)!;
export const sim = (f: Fight): Sim => f.sim;
export const run = (f: Fight, ticks: number, events?: SimEvent[]): void => {
  for (let i = 0; i < ticks; i++) {
    f.sim.step();
    const drained = f.sim.events.drain() as SimEvent[];
    if (events) events.push(...drained);
  }
};
