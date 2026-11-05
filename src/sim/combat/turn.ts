import { CrewC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import { AboardC, BoarderC, VehicleC } from '../vehicles/components';
import type { Sim } from '../sim';
import { ShipC, type Faction } from './components';

/**
 * The ship's people change allegiance from one side to another (they stay its crew: `shipCrew` follows the ship's side): those on its grid and those
 * aboard its own shuttles (embarked crew have no position).
 */
export function turnCrew(sim: Sim, ship: number, from: Faction, to: Faction): void {
  for (const id of sim.world.query(CrewC, AllegianceC)) {
    const a = sim.world.get(id, AllegianceC);
    if (a?.faction !== from) continue;
    const pos = sim.world.get(id, PositionC);
    const aboard = sim.world.get(id, AboardC);
    const on = pos ? shipIdOf(sim, pos) : aboard ? sim.world.get(aboard.vehicle, VehicleC)?.homeShip : undefined;
    if (on === ship) a.faction = to;
  }
  // A boarding party standing on another ship's grid is still the ship's people (a visit let aboard, scene/visit.ts).
  for (const id of sim.world.get(ship, BoarderC)?.crew ?? []) {
    const a = sim.world.get(id, AllegianceC);
    if (a?.faction === from) a.faction = to;
  }
}

/** A ship and its people go over to another side (a truce ban, a provoked neutral). Its combat AI and its crew's fight code follow the side. */
export function turnShip(sim: Sim, ship: number, to: Faction): void {
  const s = sim.world.get(ship, ShipC);
  if (!s || s.faction === to) return;
  turnCrew(sim, ship, s.faction, to);
  s.faction = to;
}
