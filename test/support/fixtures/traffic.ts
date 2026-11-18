/** Small helpers shared by the galaxy traffic tests and their slow tier. */
import { CombatC } from '../../../src/sim/combat/components';
import { galaxyIndex } from '../../../src/sim/galaxy/state';
import type { Sim } from '../../../src/sim/sim';
import { playerShip } from '../../../src/sim/trade/player';
import { FTL_CHARGE_SEC } from '../../../src/sim/tuning';

export const step = (sim: Sim, n = 1) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
export const deploy = (sim: Sim) => {
  for (const [x, y] of [[100, 60], [20, 50], [300, 200], [40, 150], [200, 20], [350, 100]] as const) {
    sim.enqueue({ type: 'sector.deploy', x, y });
    step(sim);
    if (sim.sector.state === 'active') break;
  }
};
export const adjacent = (sim: Sim, id: string): string[] =>
  (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();
export const charge = (sim: Sim) => {
  const c = sim.world.get(playerShip(sim), CombatC);
  if (c) c.ftl = FTL_CHARGE_SEC;
};
export const clear = (sim: Sim) => {
  sim.galaxy.fleets = [];
};
