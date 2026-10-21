import type { Faction } from '../combat/components';

import { CrewC, DeadC, DraftedC, PositionC, type Crew } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { AllegianceC, PrisonerC } from '../fight/components';
import { isCombatReady } from '../fight/relations';
import { ModuleC } from '../modules/components';
import { rotatedSize } from '../modules/footprint';
import { CoreLinkC, HackedC, InertC, StunC, type Hacked } from '../robots/components';
import { hasLiveCore } from '../robots/core';
import { haltCrew } from '../robots/halt';
import type { Sim } from '../sim';
import { HACK_HOLD_RADIUS } from '../tuning';
import { shipIdOf } from '../regions';

/**
 * Robot control, right after power (cores are live only while powered this tick). Stuns run out. Hacked cores lose
 * their hacker once they leave (or are downed, stunned, killed). Then each core-linked robot (CoreLinkC) is run by:
 * its home ship's live AI core of its own faction, else a hacked core there whose hacker still holds it (the robot
 * fights for the hacker's side while the hold lasts), else nobody: it goes inert, dropping whatever it was doing, and
 * counts as subdued (fight/relations), so a ship whose cores are down can be captured. Prisoners are never lent out.
 */
export function robotsSystem(sim: Sim): void {
  for (const id of [...sim.world.query(StunC)]) {
    const until = sim.world.get(id, StunC)?.until ?? 0;
    if (until > sim.tick && !sim.world.has(id, DeadC)) continue;
    sim.world.remove(id, StunC);
    const crew = sim.world.get(id, CrewC);
    if (crew && !sim.world.has(id, InertC) && !sim.world.has(id, DeadC)) crew.activity = 'idle';
  }
  const held = new Map<number, Faction>(); // grid -> faction of a hacker holding a core there
  for (const id of sim.world.query(HackedC, ModuleC)) {
    const h = sim.world.get(id, HackedC) as Hacked;
    if (h.hacker && !holding(sim, h.hacker, id)) h.hacker = 0;
    const shipId = shipIdOf(sim, sim.world.get(id, ModuleC));
    if (h.hacker && !held.has(shipId)) held.set(shipId, h.by);
  }
  const live = new Map<string, boolean>();
  for (const id of sim.world.query(CoreLinkC, CrewC)) {
    if (sim.world.has(id, DeadC)) {
      sim.world.remove(id, InertC);
      continue;
    }
    const link = sim.world.get(id, CoreLinkC) as { ship: number; faction: Faction };
    const home = link.ship;
    const key = `${link.ship}:${link.faction}`;
    let on = live.get(key);
    if (on === undefined) live.set(key, (on = hasLiveCore(sim, home, link.faction)));
    const owner = on ? link.faction : sim.world.has(id, PrisonerC) ? undefined : held.get(home);
    const allegiance = sim.world.get(id, AllegianceC);
    const inert = sim.world.has(id, InertC);
    if (!owner) {
      if (allegiance) allegiance.faction = link.faction; // a lent robot goes back to its own side, inert
      if (inert) continue;
      sim.world.add(id, InertC, { tick: sim.tick });
      sim.world.remove(id, DraftedC);
      haltCrew(sim, id);
      sim.events.emit({ type: 'robot.inert', crew: id });
      continue;
    }
    if (allegiance && allegiance.faction !== owner) {
      allegiance.faction = owner;
      sim.world.remove(id, DraftedC);
      haltCrew(sim, id); // drop the old side's job and target
      sim.events.emit({ type: 'robot.flipped', crew: id, faction: owner });
    }
    if (inert || (sim.world.get(id, CrewC) as Crew).activity === 'inert') {
      sim.world.remove(id, InertC);
      if (!sim.world.has(id, StunC)) (sim.world.get(id, CrewC) as Crew).activity = 'idle';
      if (inert) sim.events.emit({ type: 'robot.active', crew: id });
    }
  }
}

/** The hacker still holds the core: able to act, on its grid, within HACK_HOLD_RADIUS of its footprint. */
function holding(sim: Sim, hacker: number, core: number): boolean {
  const m = sim.world.get(core, ModuleC);
  const pos = sim.world.get(hacker, PositionC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def || !pos || shipIdOf(sim, pos) !== shipIdOf(sim, m) || !isCombatReady(sim, hacker) || isIncapacitated(sim, hacker)) return false;
  const [w, h] = rotatedSize(def, m.rot);
  const dx = Math.max(m.x - pos.x, 0, pos.x - (m.x + w - 1));
  const dy = Math.max(m.y - pos.y, 0, pos.y - (m.y + h - 1));
  return Math.max(dx, dy) <= HACK_HOLD_RADIUS;
}
