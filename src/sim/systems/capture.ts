import { CaptureProgressC, ShipC, type Faction } from '../combat/components';
import { allSubdued, bridgeHoldTicks } from '../capture/control';
import { capturePrize } from '../capture/prize';
import type { Sim } from '../sim';

/**
 * Capture. A ship in play (active or disabled) of the player or the hostile side falls when (1) every one of its crew
 * is subdued (downed, surrendered or dead) and (2) the other side holds its bridge (a live crew member within a bridge
 * module's radius of its access tile) for the bridge's hold time without a break. Progress lives in CaptureProgressC
 * on the ship entity. A hostile ship taken by the player becomes a prize (see capturePrize); a player ship taken by
 * boarders ends the game: `game.lost`, once, and `sector.lost` is set. Neutral ships are never captured.
 */
export function captureSystem(sim: Sim): void {
  if (sim.sector.lost || !sim.sector.inCombat) return; // both sides must still be in play
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC);
    if (!ship || (ship.state !== 'active' && ship.state !== 'disabled') || ship.faction === 'neutral') continue;
    const attacker: Faction = ship.faction === 'player' ? 'hostile' : 'player';
    const need = allSubdued(sim, ship) ? bridgeHoldTicks(sim, ship, attacker) : null;
    if (need === null) {
      sim.world.remove(id, CaptureProgressC);
      continue;
    }
    let p = sim.world.get(id, CaptureProgressC);
    if (!p) {
      p = { by: attacker, ticks: 0 };
      sim.world.add(id, CaptureProgressC, p);
    }
    p.ticks++;
    if (p.ticks < need) continue;
    if (ship.faction === 'hostile') {
      capturePrize(sim, ship);
    } else {
      sim.world.remove(id, CaptureProgressC);
      sim.sector.lost = 'captured';
      sim.events.emit({ type: 'ship.captured', gridId: ship.gridId, by: attacker, from: ship.faction });
      sim.events.emit({ type: 'game.lost', reason: 'captured' });
      return;
    }
  }
}
