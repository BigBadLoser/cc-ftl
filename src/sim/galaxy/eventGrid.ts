import { ShipC } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import { liftShip } from '../sector/packet';
import { newSectorGrid } from '../stamp';
import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { isLive } from '../trade/deals';
import { FTL_CHARGE_SEC, SECTOR_HEIGHT, SECTOR_WIDTH } from '../tuning';
import { playerShipInfo } from './arrivals';
import { ftlCharge, spendCharge } from './fuel';
import { inPlay, materialiseFleet, tendFleet } from './fleetShips';
import { repKey } from './standing';
import { RESCUE_REPUTATION } from './tuning';
import type { Encounter, EventGrid, Fleet } from './types';

/**
 * Event grids: a temporary deep-space pocket (node id `event:<encounter id>`) where an encounter is settled, with the player's packet and
 * the fleet's ships. It is not a real node: not in the galaxy index, no chunk contents, no contacts, no story draw, no arrivals, no turns,
 * and it is never archived. `GalaxyState.current` stays the real node the trip is halted at, `sim.sector.node` is the event id and the
 * trip waits (`Travel.phase === 'event'`). Leaving it discards the sector and puts the ship back in hyperspace.
 * Planner's calls: the fleet is taken out of `GalaxyState.fleets` while the grid exists (nothing steps or materialises it); survivors go back
 * as descriptors (damage does not carry over), a fleet with no ship left is gone; the player's other crew or shuttles left outside are lost with the grid.
 */
export const eventNodeId = (id: number): string => `event:${id}`;
export const isEventNode = (node: string): boolean => node.startsWith('event:');
export const inEvent = (sim: Sim): boolean => sim.galaxy.event !== null;

/** Hostile (to the player) ships still in play in the sector. */
export const hostilesPresent = (sim: Sim): number =>
  sim.world.query(ShipC).filter((id) => {
    const s = sim.world.get(id, ShipC);
    return !!s && s.state === 'active' && factionsHostile(s.faction, 'player');
  }).length;

/**
 * Open the event grid for an encounter: the player's packet (waiting in hyperspace) is put up for deployment in an empty sector, the fleet's
 * ships are made real there (hostile ones on their combat side, others neutral), and the trip is held. False when the fleet is gone.
 */
export function enterEvent(sim: Sim, e: Encounter, kind: EventGrid['kind']): boolean {
  const g = sim.galaxy;
  const t = g.travel;
  const f = g.fleets.find((x) => x.id === e.fleet);
  if (!t || !f || sim.sector.state !== 'hyperspace' || g.event) return false;
  g.fleets = g.fleets.filter((x) => x !== f);
  g.event = { id: e.id, kind, encounter: { ...e }, fleet: f };
  t.held = t.phase === 'event' ? 'hop' : t.phase;
  t.phase = 'event';
  const from = sim.sector.node;
  sim.sector.node = eventNodeId(e.id);
  sim.sector.grid = newSectorGrid();
  sim.sector.width = SECTOR_WIDTH;
  sim.sector.height = SECTOR_HEIGHT;
  sim.sector.state = 'deploying';
  for (const c of f.ships) c.ship = undefined;
  materialiseFleet(sim, f, g.current);
  g.rev++;
  sim.events.emit({ type: 'sector.jumped', ship: sim.sector.packet?.ship ?? 0, from, to: sim.sector.node, restored: false });
  sim.events.emit({ type: 'galaxy.eventEntered', id: e.id, kind });
  return true;
}

/** Why the player cannot leave the event grid now, or null: a live deal, or hostiles about with the drive not charged (leaving under fire is a flee). */
export function leaveBlocker(sim: Sim): string | null {
  if (!sim.galaxy.event) return 'noEvent';
  if (sim.sector.state === 'deploying') return null;
  if (sim.trade.deals.some(isLive)) return 'tradeInProgress';
  const me = playerShipInfo(sim);
  if (!me) return 'notPlayerShip';
  if (hostilesPresent(sim) > 0 && (ftlCharge(sim, me.id) ?? 0) + 1e-9 < FTL_CHARGE_SEC) return 'notCharged';
  return null;
}

/** What is left of the fleet: ships still in play (or never spawned) go back as descriptors, the rest are forgotten. */
function settleFleet(sim: Sim, ev: EventGrid): Fleet {
  const f = ev.fleet;
  f.ships = f.ships.filter((c) => {
    const alive = c.ship === undefined || inPlay(sim, c.ship);
    c.ship = undefined;
    return alive;
  });
  f.met = sim.galaxy.turn;
  if (ev.kind === 'rescue' && f.ships.length) {
    delete f.damaged;
    f.dwell = 1;
    const key = repKey(sim, f.faction);
    sim.story.reputation[key] = reputationOf(sim.story, key) + RESCUE_REPUTATION;
    sim.events.emit({ type: 'galaxy.rescued', id: ev.id, faction: f.faction });
  }
  return f;
}

/**
 * Leave the event grid: the player's ship is lifted back into a packet (hostiles about need a charged drive, which is spent: that is a flee),
 * the sector is wiped (every entity gone, a fresh grid; nothing archived), the fleet's survivors return to the map and the trip carries
 * on from where it was held. `resume` continues an interdicted trip (see hyperspace.ts `resumeAfterHop`). False when it is refused.
 */
export function leaveEvent(sim: Sim, resume: (sim: Sim) => void, command = 'galaxy.leaveEvent'): boolean {
  const g = sim.galaxy;
  const ev = g.event;
  const t = g.travel;
  const reject = (reason: string): false => (sim.events.emit({ type: 'command.rejected', command, reason }), false);
  if (!ev || !t) return reject('noEvent');
  const blocked = leaveBlocker(sim);
  if (blocked) return reject(blocked);
  let packet = sim.sector.packet;
  if (sim.sector.state === 'active') {
    const me = playerShipInfo(sim) as NonNullable<ReturnType<typeof playerShipInfo>>;
    if (hostilesPresent(sim) > 0) spendCharge(sim, FTL_CHARGE_SEC, me.id);
    packet = liftShip(sim, me.id, { withDocked: false });
  }
  const fleet = settleFleet(sim, ev);
  if (sim.sector.inCombat) sim.events.emit({ type: 'combat.ended' });
  for (const id of sim.world.ids()) sim.world.destroyEntity(id);
  sim.sector.grid = newSectorGrid();
  sim.sector.inCombat = false;
  sim.trade.hails = [];
  sim.trade.offers = [];
  sim.sector.node = g.current;
  sim.sector.state = 'hyperspace';
  if (packet) sim.sector.packet = packet;
  g.event = null;
  if (fleet.ships.length) g.fleets = [...g.fleets, fleet].sort((a, b) => a.id - b.id);
  const held = t.held ?? 'hop';
  delete t.held;
  t.phase = held;
  g.rev++;
  sim.events.emit({ type: 'galaxy.eventLeft', id: ev.id, node: g.current });
  if (held === 'interdicted') resume(sim);
  return true;
}

/** Once a second in the event grid: forget the fleet's ships that are gone and retry the ones that had no room. */
export function tendEvent(sim: Sim): void {
  const ev = sim.galaxy.event;
  if (ev && tendFleet(sim, ev.fleet, sim.galaxy.current)) sim.galaxy.rev++;
}
