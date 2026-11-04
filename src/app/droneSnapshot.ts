import { ModuleC, type Sim } from '../sim';
import { baySlots, droneCap, dronesOf } from '../sim/drones/bay';
import { DroneC, type Drone } from '../sim/drones/components';
import { shipIdOf } from '../sim/regions';
import type { UiDroneBay } from '../ui/api';

const DOING: Record<string, string> = { repair: 'repairing', extinguish: 'putting out a fire', firstAid: 'first aid' };

/** What a drone is up to, in a few words. */
function doing(sim: Sim, d: Drone): string {
  if (d.inert) return 'inert: no AI core';
  if (d.stunUntil > sim.tick) return 'knocked out (ion)';
  if (d.state === 'docked') return d.charge < 100 ? 'charging' : 'ready';
  if (d.state === 'home') return 'returning';
  if (!d.target) return 'looking for work';
  return d.steps.length > 0 ? `on the way (${DOING[d.target.kind] ?? d.target.kind})` : DOING[d.target.kind] ?? d.target.kind;
}

/** Plain-data state of a drone bay for its panel. Reads the sim only. */
export function buildDroneBay(sim: Sim, bay: number): UiDroneBay | null {
  const m = sim.world.get(bay, ModuleC);
  if (!m || !sim.content.modules[m.def]?.droneBay) return null;
  const ship = shipIdOf(sim, m);
  const out = dronesOf(sim, ship).filter((id) => sim.world.get(id, DroneC)?.state !== 'docked').length;
  return {
    slots: baySlots(sim, bay).map((id) => {
      const d = id ? sim.world.get(id, DroneC) : undefined;
      const def = d && sim.content.drones?.[d.def];
      if (!d || !def) return null;
      const down = d.inert || d.stunUntil > sim.tick;
      return { id, name: def.name, state: down ? 'down' : d.state, doing: doing(sim, d), charge: Math.round(d.charge), hp: Math.round(d.hp), maxHp: def.maxHp };
    }),
    out,
    cap: droneCap(sim, ship),
  };
}
