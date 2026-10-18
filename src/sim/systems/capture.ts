import { CaptureProgressC, ShipC, type Faction } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import { bridgeHoldTicks, captureReady } from '../capture/control';
import { capturePrize } from '../capture/prize';
import type { Sim } from '../sim';

/** Factions that may take a ship: the player takes enemy ships; raiders or the rogue AI take the player's. */
const ATTACKERS: readonly Faction[] = ['player', 'hostile', 'rogue'];

/**
 * Capture. A ship in play (active or disabled), not neutral, falls when (1) it is capture-ready: every one of its crew
 * is subdued (downed, surrendered, dead or an inert robot) and, for an AI-run ship (rogue, or robot crew under a core),
 * none of its AI cores is live; and (2) a side at war with it holds its bridge (a live crew member within a bridge
 * module's radius of its access tile; AI cores count as bridges on AI-run ships) for the bridge's hold time without a
 * break. A crewless ship needs only (2) and, if AI-run, its cores down. Progress lives in CaptureProgressC on the ship
 * entity. An enemy ship taken by the player becomes a prize (see capturePrize); a player ship taken by boarders ends
 * the game: `game.lost`, once, and `sector.lost` is set. Only the player keeps prizes: other captures are ignored.
 */
export function captureSystem(sim: Sim): void {
  if (sim.sector.lost || !sim.sector.inCombat) return; // both sides must still be in play
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC);
    if (!ship || (ship.state !== 'active' && ship.state !== 'disabled') || ship.faction === 'neutral') continue;
    let attacker: Faction | null = null;
    let need: number | null = null;
    if (captureReady(sim, ship)) {
      for (const f of ATTACKERS) {
        if (!factionsHostile(f, ship.faction) || (f !== 'player' && ship.faction !== 'player')) continue;
        need = bridgeHoldTicks(sim, ship, f);
        if (need !== null) {
          attacker = f;
          break;
        }
      }
    }
    let p = sim.world.get(id, CaptureProgressC);
    if (need === null || attacker === null || (p && p.by !== attacker)) {
      sim.world.remove(id, CaptureProgressC);
      if (need === null || attacker === null) continue;
      p = undefined;
    }
    if (!p) {
      p = { by: attacker, ticks: 0 };
      sim.world.add(id, CaptureProgressC, p);
    }
    p.ticks++;
    if (p.ticks < need) continue;
    if (ship.faction !== 'player') {
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
