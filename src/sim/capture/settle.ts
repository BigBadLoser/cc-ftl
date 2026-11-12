import { PrizeC, ShipC } from '../combat/components';
import { wreckShip } from '../combat/wreck';
import { CrewC, PositionC } from '../crew/components';
import { removeCrew } from '../crew/depart';
import { AllegianceC, PrisonerC } from '../fight/components';
import { factionOfShip } from '../galaxy/heat';
import { RELEASE_REPUTATION } from '../galaxy/tuning';
import { repKey } from '../galaxy/standing';
import { reputationOf } from '../story/state';
import { guestOn } from '../consent/guests';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { capturePrize } from './prize';

/**
 * The player's answer to a beaten ship (`Ship.yielded`, set by systems/shipState.ts once every crew member is subdued and none of the player's can reach it);
 * a reject reason, or null when it was taken.
 * - 'letGo': the enemy crew leave alive (removed, no corpses; guests stay) and the ship is a derelict: its loot and modules are left for salvage.
 * - 'takePrisoners': the ship is a prize (`capturePrize`) and its subdued crew prisoners, who stay put.
 * Nothing waits on a ship that is not yielded; zealots (`neverSurrenders`) are wrecked straight away and never offer it.
 */
export function settleYielded(sim: Sim, shipId: number, choice: 'letGo' | 'takePrisoners'): string | null {
  const ship = sim.world.get(shipId, ShipC);
  if (!ship?.yielded) return 'notYielded';
  delete ship.yielded;
  if (choice === 'takePrisoners') {
    capturePrize(sim, shipId);
    return null;
  }
  let gone = 0;
  for (const id of [...sim.world.query(CrewC, PositionC)]) {
    if (shipIdOf(sim, sim.world.get(id, PositionC)) !== shipId || sim.world.get(id, AllegianceC)?.faction === 'player' || guestOn(sim, id, shipId)) continue;
    removeCrew(sim, id);
    gone++;
  }
  sim.events.emit({ type: 'ship.letGo', ship: shipId, crew: gone });
  wreckShip(sim, shipId);
  return null;
}

/**
 * Release a prisoner: they leave play alive at once (removed, no walk to a ship: a prize holds no shuttle of theirs) and the galaxy faction their ship flew for
 * (`factionOfShip`) thinks better of the player by RELEASE_REPUTATION. A reject reason, or null.
 */
export function releasePrisoner(sim: Sim, crew: number): string | null {
  const pos = sim.world.get(crew, PositionC);
  if (!sim.world.has(crew, PrisonerC) || !pos) return 'notPrisoner';
  const shipId = shipIdOf(sim, pos);
  const ship = sim.world.get(shipId, ShipC);
  const faction = ship ? factionOfShip(sim, shipId, ship, sim.world.get(shipId, PrizeC)?.from ?? ship.faction) : null;
  const name = sim.world.get(crew, CrewC)?.name ?? 'Prisoner';
  removeCrew(sim, crew);
  if (faction) {
    const key = repKey(sim, faction);
    sim.story.reputation[key] = reputationOf(sim.story, key) + RELEASE_REPUTATION;
  }
  sim.events.emit({ type: 'crew.released', crew, name, ship: shipId, faction: faction ?? '' });
  return null;
}
