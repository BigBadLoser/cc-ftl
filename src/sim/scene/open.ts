import { CombatC, ShipC, type Faction } from '../combat/components';
import { liftShip } from '../sector/packet';
import { isLive } from '../trade/deals';
import { FTL_CHARGE_SEC } from '../tuning';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { ensureTrader } from '../trade/traders';
import { spawnContact } from '../galaxy/arrivals';
import { spawnSceneDerelict } from './derelicts';
import { startVisitClock, tendVisit, visiting } from './visit';
import { BoarderC } from '../vehicles/components';
import type { SceneShip, SceneSpec, Stance } from './types';

/**
 * Making a scene real in its pocket: its ships through the node-contact path (`spawnContact`: the generator, the deploy bounds, the gap rule), on the
 * side their stance gives, with the crew, stock and wallet the spec rolled; its timers start. The scene sets conditions only: what happens next is
 * the sim's.
 */

/** The combat side a stance puts a ship on: hostile ones on their owner's side, the rest neutral. */
function sideOf(sim: Sim, owner: string, stance: Stance): Faction {
  return stance === 'hostile' ? sim.content.galaxy?.factions[owner]?.combatFaction ?? 'hostile' : 'neutral';
}

/** Spawn one scene ship (false: no room yet, retried by `tendScene`). Its trade stock and wallet are the scene's when it rolled them. */
function spawnSceneShip(sim: Sim, s: SceneShip): boolean {
  const opts = { side: sideOf(sim, s.contact.faction, s.stance), ...(s.crew !== undefined ? { crew: s.crew } : {}) };
  if (!spawnContact(sim, sim.galaxy.current, s.contact, opts) || s.contact.ship === undefined) return false;
  if (s.cargo || s.credits !== undefined || s.attitude !== undefined) {
    const t = ensureTrader(sim, s.contact.ship);
    if (t && s.attitude !== undefined) t.relation = s.attitude;
    if (t && s.cargo) t.stock = s.cargo.map((q) => ({ ...q }));
    if (t && s.credits !== undefined) t.credits = s.credits;
  }
  // A trap's boarding party is the size the scene says (the generator's doctrine may differ), armed with whatever the doctrine issues; it only goes when let in.
  const party = s.ambush ? sim.world.get(s.contact.ship, BoarderC) : undefined;
  if (party && s.ambush) {
    party.party = s.ambush.party;
    if (!s.ambush.trap) delete party.weapon; // an honest party comes unarmed
  }
  return true;
}

/** Open a scene in the (fresh) event grid: spawn its derelicts and ships and start its timers. */
export function openScene(sim: Sim, spec: SceneSpec): void {
  for (const d of spec.derelicts) if (d.ship === undefined) spawnSceneDerelict(sim, d);
  for (const s of spec.ships) {
    if (s.stay !== undefined) s.leaveAt = sim.tick + Math.round(s.stay * TICK_HZ);
    startVisitClock(sim, s);
    if (s.contact.ship === undefined) spawnSceneShip(sim, s);
  }
  for (const t of spec.timers) t.at = sim.tick + Math.round(t.afterSec * TICK_HZ);
}

/**
 * Once a second: lift the scene's ships that jumped away (the observer has already seen them go; they are not respawned) and retry the ships and
 * derelicts that found no room. True when something changed.
 */
export function tendScene(sim: Sim, spec: SceneSpec): boolean {
  let changed = tendVisit(sim, spec);
  for (const d of spec.derelicts) if (d.ship === undefined && spawnSceneDerelict(sim, d)) changed = true;
  for (const s of spec.ships) {
    const id = s.contact.ship;
    if (id !== undefined && sim.world.get(id, ShipC)?.state === 'fled') {
      liftShip(sim, id);
      sim.trade.hails = sim.trade.hails.filter((h) => h.ship !== id);
      sim.trade.offers = sim.trade.offers.filter((o) => o.ship !== id);
      s.contact.ship = undefined;
      s.gone = 'fled';
      changed = true;
    } else if (id === undefined && !s.gone && spawnSceneShip(sim, s)) changed = true;
  }
  return changed;
}

/**
 * A neutral scene ship moves on when its business here is done (`leaveAt`): like a scene director, it gives the ship a standing drive-charge order (the
 * ordinary helm job seats one of its crew), and once the drive is charged the ship jumps out through the ordinary `combat.flee`, as a fleeing NPC does. One that was hailed holds station; so does one in the middle of a deal. Hostile ones are the combat AI's.
 */
export function departScene(sim: Sim, spec: SceneSpec): void {
  for (const s of spec.ships) {
    const id = s.contact.ship;
    const ship = id === undefined ? undefined : sim.world.get(id, ShipC);
    if (id === undefined || !ship) continue;
    if (!s.hailed && !s.dismissed && sim.trade.hails.some((h) => h.ship === id && h.answered)) s.hailed = true;
    if ((s.hailed && !s.dismissed) || visiting(s.ambush) || s.leaveAt === undefined || sim.tick < s.leaveAt || ship.faction !== 'neutral' || ship.state !== 'active') continue;
    if (sim.trade.deals.some((d) => d.ship === id && isLive(d))) continue;
    const combat = sim.world.get(id, CombatC);
    if (!combat) continue;
    // Its own crew charge the drive as any crew does (a standing charge order seats a pilot at the helm), then it jumps.
    if (combat.ftl + 1e-9 >= FTL_CHARGE_SEC) sim.enqueue({ type: 'combat.flee', ship: id });
    else combat.ftlOrder ??= { jump: null };
  }
}
