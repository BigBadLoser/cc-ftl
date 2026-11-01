import { shipIdOf } from '../regions';
import { CarriedC, CrewC, DeadC, DownedC, DraftedC, HealthC, PositionC } from '../crew/components';
import { factionsHostile, rogueAlly } from '../combat/factions';

import { InertC, StunC } from '../robots/components';
import type { Sim } from '../sim';
import { AllegianceC, EquipOrderC, FighterC, StowOrderC, SurrenderedC } from './components';
import { shipById } from '../combat/ships';
import { AlienC } from '../aliens/components';
import { StationCrewC, WantedC } from '../stations/components';
import { YardCrewC } from '../yard/types';

/**
 * True if the two crew members are on opposing sides (see factionsHostile: neutral fights nobody, rogue everybody), or one
 * is wanted by the station the other belongs to (an intruder, or invited crew who attacked: stations/alarm).
 */
export function isHostile(sim: Sim, a: number, b: number): boolean {
  if (factionsHostile(sim.world.get(a, AllegianceC)?.faction, sim.world.get(b, AllegianceC)?.faction) && !machineAllies(sim, a, b)) return true;
  const wanted = (x: number, y: number): boolean => {
    const w = sim.world.get(x, WantedC);
    return !!w && sim.world.get(y, StationCrewC)?.station === w.station;
  };
  return wanted(a, b) || wanted(b, a);
}

/** Is one of the two a rogue-side crew member and the other a zealot (a machine ally on the neutral side while the player is on good terms with them)? */
function machineAllies(sim: Sim, a: number, b: number): boolean {
  const side = (x: number): string | undefined => sim.world.get(x, AllegianceC)?.faction;
  const zealot = (x: number): boolean => {
    const pos = sim.world.get(x, PositionC);
    return !!pos && rogueAlly(sim, shipIdOf(sim, pos));
  };
  return (side(a) === 'rogue' && zealot(b)) || (side(b) === 'rogue' && zealot(a));
}

/** Surrendered, downed, dead or an inert robot: out of the fight. Capture treats all of them as taken. */
export function isSubdued(sim: Sim, crew: number): boolean {
  return sim.world.has(crew, SurrenderedC) || sim.world.has(crew, DownedC) || sim.world.has(crew, DeadC) || sim.world.has(crew, InertC);
}

/** Alive, on a grid, able to act and still in the fight (not downed, carried, dead, surrendered, inert or stunned). */
export function isCombatReady(sim: Sim, crew: number): boolean {
  if (!sim.world.has(crew, CrewC) || !sim.world.has(crew, PositionC)) return false;
  if (isSubdued(sim, crew) || sim.world.has(crew, CarriedC) || sim.world.has(crew, StunC)) return false;
  const hp = sim.world.get(crew, HealthC);
  return !hp || hp.hp > 0;
}

/** True if the crew member stands on a wreck: nobody there to fight for it, so the player's crew work it (salvage) rather than boarding it. */
export function onWreck(sim: Sim, crew: number): boolean {
  const pos = sim.world.get(crew, PositionC);
  return !!pos && shipById(sim, shipIdOf(sim, pos))?.state === 'wreck';
}

/** An invader that is still boarding: on a wreck an invader is just crew at work, so it takes jobs like anyone (the fight code still counts it as an invader). */
export function isBoarding(sim: Sim, crew: number): boolean {
  return isInvader(sim, crew) && !onWreck(sim, crew);
}

/** True if the crew member is on a ship of another faction than their own (a boarder). Aliens never are, nor are the shipyard's contractors. */
export function isInvader(sim: Sim, crew: number): boolean {
  if (sim.world.has(crew, AlienC)) return false; // creatures live where they hatched: they never board or take ships
  if (sim.world.has(crew, YardCrewC)) return false; // the shipyard's contractors are invited aboard to build
  const faction = sim.world.get(crew, AllegianceC)?.faction;
  const pos = sim.world.get(crew, PositionC);
  const ship = pos && shipById(sim, shipIdOf(sim, pos));
  return !!faction && !!ship && ship.faction !== faction;
}

/** True if the player directs this crew member in combat: player side and drafted. */
export function isPlayerControlled(sim: Sim, crew: number): boolean {
  return sim.world.get(crew, AllegianceC)?.faction === 'player' && sim.world.has(crew, DraftedC);
}

/** True if the crew member must not pick colony jobs: fighting, fetching or stowing a weapon, surrendered or invading. */
export function isOffDuty(sim: Sim, crew: number): boolean {
  const f = sim.world.get(crew, FighterC);
  return (!!f && f.mode !== 'idle') || sim.world.has(crew, EquipOrderC) || sim.world.has(crew, StowOrderC) || sim.world.has(crew, SurrenderedC) || isBoarding(sim, crew);
}
