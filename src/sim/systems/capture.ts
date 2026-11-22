import { CaptureProgressC, ShipC, type Faction } from '../combat/components';
import { battleAnywhere } from '../combat/engage';
import { factionsHostile } from '../combat/factions';
import { bridgeHold, captureReady } from '../capture/control';
import { capturePrize } from '../capture/prize';
import { crewShipOf } from '../fight/relations';
import { AllegianceC } from '../fight/components';
import { inEngagement, opposed } from '../galaxy/engagements';
import { takeShip } from '../galaxy/engagementPrize';
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
 * the game: `game.lost`, once, and `sector.lost` is set. NPCs take each other's ships the same way in a fight between NPC ships here (#603): a
 * boarding party serving a ship of the other side (`crewShipOf`) that holds the bridge takes the ship for its fleet (galaxy/engagementPrize.ts).
 */
export function captureSystem(sim: Sim): void {
  if (sim.sector.lost || !battleAnywhere(sim)) return; // both sides must still be in play
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC);
    if (!ship || (ship.state !== 'active' && ship.state !== 'disabled')) continue;
    const engaged = inEngagement(sim, id);
    if (ship.faction === 'neutral' && !engaged) continue;
    let attacker: Faction | null = null;
    let need: number | null = null;
    let captor = 0;
    if (captureReady(sim, id)) {
      for (const f of sim.sector.inCombat ? ATTACKERS : []) {
        if (!factionsHostile(f, ship.faction) || (f !== 'player' && ship.faction !== 'player')) continue;
        need = bridgeHold(sim, id, f)?.ticks ?? null;
        if (need !== null) {
          attacker = f;
          break;
        }
      }
      const hold = need === null && engaged ? bridgeHold(sim, id, (c) => opposed(sim, crewShipOf(sim, c), id)) : null;
      if (hold) {
        need = hold.ticks;
        captor = crewShipOf(sim, hold.by);
        attacker = sim.world.get(hold.by, AllegianceC)?.faction ?? null;
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
    if (captor) {
      sim.world.remove(id, CaptureProgressC);
      takeShip(sim, id, captor);
    } else if (ship.faction !== 'player') {
      capturePrize(sim, id);
    } else {
      sim.world.remove(id, CaptureProgressC);
      sim.sector.lost = 'captured';
      sim.events.emit({ type: 'ship.captured', ship: id, by: attacker, from: ship.faction });
      sim.events.emit({ type: 'game.lost', reason: 'captured' });
      return;
    }
  }
}
