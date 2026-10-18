import { CarriedC, CrewC, DeadC, DownedC, DraftedC, HealthC, PositionC } from '../crew/components';
import { factionsHostile } from '../combat/factions';
import { shipOf } from '../combat/ships';
import { InertC, StunC } from '../robots/components';
import type { Sim } from '../sim';
import { AllegianceC, EquipOrderC, FighterC, SurrenderedC } from './components';

/** True if the two crew members are on opposing sides (see factionsHostile: neutral fights nobody, rogue everybody). */
export function isHostile(sim: Sim, a: number, b: number): boolean {
  return factionsHostile(sim.world.get(a, AllegianceC)?.faction, sim.world.get(b, AllegianceC)?.faction);
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

/** True if the crew member is on a ship of another faction than their own (a boarder). */
export function isInvader(sim: Sim, crew: number): boolean {
  const faction = sim.world.get(crew, AllegianceC)?.faction;
  const pos = sim.world.get(crew, PositionC);
  const ship = pos && shipOf(sim, pos.gridId);
  return !!faction && !!ship && ship.faction !== faction;
}

/** True if the player directs this crew member in combat: player side and drafted. */
export function isPlayerControlled(sim: Sim, crew: number): boolean {
  return sim.world.get(crew, AllegianceC)?.faction === 'player' && sim.world.has(crew, DraftedC);
}

/** True if the crew member must not pick colony jobs: fighting, fetching a weapon, surrendered or invading. */
export function isOffDuty(sim: Sim, crew: number): boolean {
  const f = sim.world.get(crew, FighterC);
  return (!!f && f.mode !== 'idle') || sim.world.has(crew, EquipOrderC) || sim.world.has(crew, SurrenderedC) || isInvader(sim, crew);
}
