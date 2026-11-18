/** Shared setups of the ground-turret tests (#514) and their slow tier: the starter ship beside a prefab surface trading outpost. */
import { ShipC } from '../../../src/sim/combat/components';
import { hostileAct } from '../../../src/sim/combat/provoke';
import { ModuleC } from '../../../src/sim/modules/components';
import { newGame } from '../../../src/sim/newGame';
import type { ModuleDef } from '../../../src/sim/registry';
import type { Sim } from '../../../src/sim/sim';
import { Struct } from '../../../src/sim/structure';
import { content } from '../content';
import { run as runEvents } from '../run';
import { cachedWorld } from '../world';

export const MODS: Record<string, ModuleDef> = content.modules;

export type Ev = { type: string; ship?: number };

/** Step `n` times and return the events drained. */
export const run = (sim: Sim, n: number): Ev[] => runEvents(sim, n) as Ev[];

/** The starter ship plus a surface trading outpost (a prefab base), built once per file per seed and cloned; returns the base and its ground turrets. */
export function setup(seed = 1): { sim: Sim; base: number; turrets: number[] } {
  const sim = cachedWorld(`groundTurrets:${seed}`, () => {
    const g = newGame(2, content);
    g.enqueue({ type: 'debug.spawnOutpost', style: 'surface', kind: 'trading', seed });
    g.step();
    return g;
  });
  const base = [...sim.world.query(ShipC)].find((id) => sim.world.get(id, ShipC)?.outpost)!;
  const turrets = [...sim.world.query(ModuleC)].filter((id) => {
    const m = sim.world.get(id, ModuleC)!;
    const def = MODS[m.def];
    return (def?.weapon || def?.pointDefense) && sim.sector.grid.get('struct', m.x, m.y) === Struct.Ground;
  });
  return { sim, base, turrets };
}

/** Provoke the base into a fight: one hostile act wakes a dormant neutral outpost and turns it (combat/provoke.ts). */
export function provoke(sim: Sim, base: number): void {
  hostileAct(sim, base, 'fired');
}
