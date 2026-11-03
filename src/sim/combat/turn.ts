import { CrewC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { ShipC, type Faction } from './components';

/** The ship's people on its grid change allegiance from one side to another (they stay its crew: `shipCrew` follows the ship's side). */
export function turnCrew(sim: Sim, ship: number, from: Faction, to: Faction): void {
  for (const id of sim.world.query(CrewC, AllegianceC, PositionC)) {
    const a = sim.world.get(id, AllegianceC);
    if (a?.faction === from && shipIdOf(sim, sim.world.get(id, PositionC)) === ship) a.faction = to;
  }
}

/** A ship and its people go over to another side (a truce ban, a provoked neutral). Its combat AI and its crew's fight code follow the side. */
export function turnShip(sim: Sim, ship: number, to: Faction): void {
  const s = sim.world.get(ship, ShipC);
  if (!s || s.faction === to) return;
  turnCrew(sim, ship, s.faction, to);
  s.faction = to;
}
