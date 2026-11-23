import { guestHere, guestOn } from '../consent/guests';
import { shipIdOf } from '../regions';
import { AssignmentC, CrewC, DeadC, DownedC, DraftedC, HealthC, JobC, PositionC } from '../crew/components';
import { factionsHostile, rogueAlly } from '../combat/factions';

import { InertC } from '../robots/components';
import { isBreaking, isIncapacitated } from '../crew/helpers';
import { crewOf, PLAYER, type Side, isPlayers } from '../side';
import type { Sim } from '../sim';
import { AllegianceC, EquipOrderC, FighterC, SurrenderedC } from './components';
import { shipById } from '../combat/shipQuery';
import { opposed } from '../galaxy/engagements';
import { AboardC, VehicleC } from '../vehicles/components';
import type { Faction } from '../combat/components';
import { AlienC } from '../aliens/components';
import { StationCrewC, WantedC } from '../stations/components';
import { AwayC } from '../away/components';

/**
 * The ship a crew member serves, or 0: the one a boarding party left (`Allegiance.ship`), else the ship of their own side they stand on or whose
 * shuttle they ride. A crew member aboard a ship of another side (a prisoner, a guest) serves none of theirs there.
 */
export function crewShipOf(sim: Sim, crew: number): number {
  const a = sim.world.get(crew, AllegianceC);
  if (!a) return 0;
  if (a.ship !== undefined) return a.ship;
  const pos = sim.world.get(crew, PositionC);
  const aboard = pos ? undefined : sim.world.get(crew, AboardC);
  const id = pos ? shipIdOf(sim, pos) : (aboard && sim.world.get(aboard.vehicle, VehicleC)?.homeShip) ?? 0;
  return id && shipById(sim, id)?.faction === a.faction ? id : 0;
}

/**
 * True if the two crew members are on opposing sides (see factionsHostile: neutral fights nobody, rogue everybody), serve ships on opposite sides of
 * a fight between NPC ships here (galaxy/engagements.ts: NPCs fight each other as they would the player), or one is wanted by the station the other
 * belongs to (an intruder, or invited crew who attacked: stations/alarm).
 */
export function isHostile(sim: Sim, a: number, b: number): boolean {
  if (factionsHostile(sim.world.get(a, AllegianceC)?.faction, sim.world.get(b, AllegianceC)?.faction) && !machineAllies(sim, a, b)) return true;
  if (sim.sector.engagements?.length && opposed(sim, crewShipOf(sim, a), crewShipOf(sim, b))) return true;
  const wanted = (x: number, y: number): boolean => {
    const w = sim.world.get(x, WantedC);
    return !!w && sim.world.get(y, StationCrewC)?.station === w.station;
  };
  return wanted(a, b) || wanted(b, a);
}

/** The player's living crew (the player faction's side of every `isHostile` question about "us"). */
export const playerCrew = (sim: Sim): number[] => crewOf(sim, PLAYER, { packedOk: true });

/**
 * True if this crew member is an active foe of the side right now: hostile to some crew member of the side (`isHostile`: opposing
 * factions, creatures, rogues, station crew once the side's crew is wanted there) and still in the fight (`isCombatReady`: not
 * surrendered, downed, dead, inert or stunned). Neutral crew (station crew, traders, guests) are not. Pass `members` (`crewOf`)
 * when asking about many crew.
 */
export function isFoeOf(sim: Sim, side: Side, crew: number, members: readonly number[] = crewOf(sim, side, { packedOk: true })): boolean {
  return isCombatReady(sim, crew) && members.some((p) => p !== crew && isHostile(sim, p, crew));
}

/** Every active foe of the side (`isFoeOf`). */
export function foesOf(sim: Sim, side: Side): number[] {
  const members = crewOf(sim, side, { packedOk: true });
  return members.length ? sim.world.query(CrewC, PositionC).filter((id) => isFoeOf(sim, side, id, members)) : [];
}

/** `isFoeOf` for the player. */
export const isPlayerFoe = (sim: Sim, crew: number, players: readonly number[] = playerCrew(sim)): boolean => isFoeOf(sim, PLAYER, crew, players);

/** Every active foe of the player (`isPlayerFoe`). */
export const playerFoes = (sim: Sim): number[] => foesOf(sim, PLAYER);

/**
 * True if `isHostile` could hold for some ordered pair of these crew: two of them on factions that are hostile to each other,
 * or any of them wanted (a `WantedC` makes hostility depend on the other's station). False proves `isHostile(a, b)` is false
 * for every pair (a machine ally only ever removes hostility), so a caller may skip the pairwise search.
 */
export function mayHaveHostilePair(sim: Sim, crew: readonly number[]): boolean {
  if (sim.sector.engagements?.length) return true; // NPC crews of one side may serve ships on opposite sides of a fight
  const factions: (Faction | undefined)[] = [];
  for (const id of crew) {
    if (sim.world.has(id, WantedC)) return true;
    const f = sim.world.get(id, AllegianceC)?.faction;
    if (!factions.includes(f)) factions.push(f);
  }
  for (let i = 0; i < factions.length; i++) {
    for (let j = i + 1; j < factions.length; j++) if (factionsHostile(factions[i], factions[j])) return true;
  }
  return false;
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
  if (isSubdued(sim, crew) || isIncapacitated(sim, crew)) return false; // downed, carried, resting in a bed or pod, dead, inert or stunned
  const hp = sim.world.get(crew, HealthC);
  return !hp || hp.hp > 0;
}

/** True if the crew member stands on a wreck: nobody there to fight for it, so the player's crew work it (salvage) rather than boarding it. */
export function onWreck(sim: Sim, crew: number): boolean {
  const pos = sim.world.get(crew, PositionC);
  return !!pos && shipById(sim, shipIdOf(sim, pos))?.state === 'wreck';
}

/**
 * An invader that is still boarding: on a wreck an invader is just crew at work, so it takes jobs like anyone (the fight code still counts it
 * as an invader). Nor is one of an away party on the way back aboard (recalled, fetched, riding out a trip: `Away`): the crew AI's return
 * drive takes them to the shuttle, not the fight code to the bridge.
 */
export function isBoarding(sim: Sim, crew: number): boolean {
  return isInvader(sim, crew) && !onWreck(sim, crew) && !headingAboard(sim, crew);
}

/**
 * True for crew under an away order to go aboard a site's shuttle: a party member called home by the player, fetched or riding the round
 * trip, or a named invitee walking to the seat held for them (a passage job held by its `holder`, away/passage.ts). Their walk is theirs:
 * the fight code neither sends them hunting nor fleeing (fighter.ts), and a party member on the way back is not boarding (`isBoarding`).
 */
export function headingAboard(sim: Sim, crew: number): boolean {
  const away = sim.world.get(crew, AwayC);
  if (away) return !!(away.recall || away.pickup || away.ride);
  const job = sim.world.get(sim.world.get(crew, AssignmentC)?.jobId ?? 0, JobC);
  return job?.kind === 'passage' && job.holder === crew;
}

/**
 * True if the crew member is on a ship of another faction than their own, or of the other side of a fight between NPC ships (a boarder). Aliens never are, nor is anyone aboard by the ship's leave (a
 * consent grant: an aid party, the shipyard's contractors, a skiff's party let dock, consent/).
 */
export function isInvader(sim: Sim, crew: number): boolean {
  if (sim.world.has(crew, AlienC)) return false; // creatures live where they hatched: they never board or take ships
  const faction = sim.world.get(crew, AllegianceC)?.faction;
  const pos = sim.world.get(crew, PositionC);
  const id = pos ? shipIdOf(sim, pos) : 0;
  const ship = pos && shipById(sim, id);
  if (!faction || !ship || guestOn(sim, crew, id)) return false;
  const own = sim.world.get(crew, AllegianceC)?.ship;
  return ship.faction !== faction || (own !== undefined && own !== id && opposed(sim, own, id));
}

/**
 * True if the crew member is on the player's side: the player's own crew anywhere, or a friendly guest aboard a player ship (a passenger).
 * Enemy boarders, prisoners, creatures and the crews of other ships are not. The one answer for "does this crew member's trouble matter
 * to the player" (the ship's log and the alerts ask it).
 */
export function isOnOurSide(sim: Sim, crew: number): boolean {
  const faction = sim.world.get(crew, AllegianceC)?.faction;
  if (!faction) return false;
  if (faction === PLAYER) return true;
  if (factionsHostile(PLAYER, faction)) return false;
  const pos = sim.world.get(crew, PositionC);
  return !!pos && isPlayers(sim, shipIdOf(sim, pos));
}

/** True if the player directs this crew member in combat: player side and drafted. */
export function isPlayerControlled(sim: Sim, crew: number): boolean {
  return isPlayers(sim, crew) && sim.world.has(crew, DraftedC);
}

/**
 * True if the crew member must not pick colony jobs: fighting, fetching or stowing a weapon, surrendered, invading, or a guest who is not aboard to work
 * (a grant without `work`: a skiff's party let dock stands by, it does not take the host's chores).
 */
export function isOffDuty(sim: Sim, crew: number): boolean {
  if (isBreaking(sim, crew)) return true; // a mental break (panic, freeze, hide, tantrum, despair) holds them out of the colony loop
  const f = sim.world.get(crew, FighterC);
  if ((!!f && f.mode !== 'idle') || sim.world.has(crew, EquipOrderC) || sim.world.has(crew, SurrenderedC) || isBoarding(sim, crew)) return true;
  const g = guestHere(sim, crew);
  return !!g && !g.work && !g.lodge; // a lodging guest lives aboard (sleeps, eats) and only takes no jobs (`refusesWork`)
}
