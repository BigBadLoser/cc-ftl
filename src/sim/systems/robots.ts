import { CrewC, DeadC, DraftedC, type Crew } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { CoreLinkC, InertC, StunC } from '../robots/components';
import { hasLiveCore } from '../robots/core';
import { haltCrew } from '../robots/halt';
import type { Sim } from '../sim';

/**
 * Robot control, right after power (cores are live only while powered this tick). Stuns run out. Core-linked robots
 * (CoreLinkC) go inert, dropping whatever they were doing, while their home ship has no live AI core of their faction
 * (destroyed, unpowered, ion-disabled, hacked, or the ship was captured), and come back online when one is live again.
 * Inert robots count as subdued (fight/relations), so a ship whose cores are down can be captured.
 */
export function robotsSystem(sim: Sim): void {
  for (const id of [...sim.world.query(StunC)]) {
    const until = sim.world.get(id, StunC)?.until ?? 0;
    if (until > sim.tick && !sim.world.has(id, DeadC)) continue;
    sim.world.remove(id, StunC);
    const crew = sim.world.get(id, CrewC);
    if (crew && !sim.world.has(id, InertC) && !sim.world.has(id, DeadC)) crew.activity = 'idle';
  }
  const live = new Map<string, boolean>();
  for (const id of sim.world.query(CoreLinkC, CrewC)) {
    if (sim.world.has(id, DeadC)) {
      sim.world.remove(id, InertC);
      continue;
    }
    const gridId = (sim.world.get(id, CoreLinkC) as { gridId: number }).gridId;
    const faction = sim.world.get(id, AllegianceC)?.faction ?? 'rogue';
    const key = `${gridId}:${faction}`;
    let on = live.get(key);
    if (on === undefined) live.set(key, (on = hasLiveCore(sim, gridId, faction)));
    const inert = sim.world.has(id, InertC);
    if (!on && !inert) {
      sim.world.add(id, InertC, { tick: sim.tick });
      sim.world.remove(id, DraftedC);
      haltCrew(sim, id);
      sim.events.emit({ type: 'robot.inert', crew: id });
    } else if (on && inert) {
      sim.world.remove(id, InertC);
      if (!sim.world.has(id, StunC)) (sim.world.get(id, CrewC) as Crew).activity = 'idle';
      sim.events.emit({ type: 'robot.active', crew: id });
    }
  }
}
