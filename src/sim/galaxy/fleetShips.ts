import { ShipC } from '../combat/components';
import { liftShip } from '../sector/packet';
import type { Sim } from '../sim';
import { spawnContact } from './arrivals';
import { FLEET_NODE_SHIPS } from './tuning';
import type { Fleet, FleetRole } from './types';
import type { GalaxyFactionDef } from './defs';

/** A fleet's role from its faction's kind (`u` in [0, 1) splits the corporations between convoys and patrols). */
export function fleetRoleOf(kind: GalaxyFactionDef['kind'], u: number): FleetRole {
  switch (kind) {
    case 'government': return 'patrol';
    case 'corporation': return u < 0.7 ? 'trader' : 'patrol';
    case 'civilian': return 'trader';
    case 'pirates': return 'pirate';
    case 'rogue': return 'raider';
  }
}

/** Is the fleet's ship still a ship in play (not wrecked, fled, taken or gone)? */
export const inPlay = (sim: Sim, id: number): boolean => {
  const s = sim.world.get(id, ShipC);
  return !!s && s.faction !== 'player' && (s.state === 'active' || s.state === 'disabled');
};

/**
 * The fleet is at the player's active node: make its ships real through the node-contact path (`spawnContact`: the faction's
 * generator, the deploy bounds and the gap rule; `node` is the galaxy node the sector stands for, the fleet's own unless it is met elsewhere, as in an event grid), up to FLEET_NODE_SHIPS ships in the sector. Ships that find no room stay descriptors and are retried by `tendFleets`.
 */
export function materialiseFleet(sim: Sim, f: Fleet, node: string = f.node): void {
  for (const c of f.ships) if (c.ship === undefined && shipsInPlay(sim) < FLEET_NODE_SHIPS) spawnContact(sim, node, c);
}

/** Ships in the sector other than the player's that are still in play: the room the node has left for arrivals. */
function shipsInPlay(sim: Sim): number {
  return sim.world.query(ShipC).filter((id) => {
    const s = sim.world.get(id, ShipC);
    return !!s && s.faction !== 'player' && (s.state === 'active' || s.state === 'disabled');
  }).length;
}

/**
 * The fleet leaves the player's node (or the player does): every ship still in play is lifted out of the sector with `liftShip`
 * (tiles cleared, entities detached) and becomes a descriptor again; ships that were wrecked, fled or taken are forgotten. The
 * packet is dropped on purpose: damage does not carry over (a planner's call; `stampPacket` could restore it later). Hails and offers
 * for the lifted ships go too. So a node's archive never holds a fleet's ship, and nothing is duplicated when the player returns.
 */
export function liftFleet(sim: Sim, f: Fleet): void {
  const gone = new Set<number>();
  f.ships = f.ships.filter((c) => {
    if (c.ship === undefined) return true;
    const id = c.ship;
    c.ship = undefined;
    if (!inPlay(sim, id)) return false;
    liftShip(sim, id);
    gone.add(id);
    return true;
  });
  if (!gone.size) return;
  sim.trade.hails = sim.trade.hails.filter((h) => !gone.has(h.ship));
  sim.trade.offers = sim.trade.offers.filter((o) => !gone.has(o.ship));
  sim.galaxy.rev++;
}

/** Lift every fleet ship out of the node the player is about to leave. */
export function liftFleetsAt(sim: Sim, node: string): void {
  for (const f of sim.galaxy.fleets) if (f.node === node) liftFleet(sim, f);
}

/** Materialise every fleet waiting in the node the player just dropped into. */
export function materialiseFleetsAt(sim: Sim, node: string): void {
  for (const f of sim.galaxy.fleets) if (f.node === node) materialiseFleet(sim, f);
}

/** Forget a fleet's ships that are gone and retry the ones that had no room. True when its ship list changed. */
export function tendFleet(sim: Sim, f: Fleet, node: string = f.node): boolean {
  const before = f.ships.length;
  f.ships = f.ships.filter((c) => c.ship === undefined || inPlay(sim, c.ship));
  materialiseFleet(sim, f, node);
  return f.ships.length !== before;
}

/** Once a second in the active node: forget ships that are gone, drop fleets with none left, retry ships that had no room. */
export function tendFleets(sim: Sim): void {
  const g = sim.galaxy;
  let changed = false;
  for (const f of g.fleets) if (f.node === g.current && tendFleet(sim, f)) changed = true;
  const alive = g.fleets.filter((f) => f.ships.length > 0);
  if (alive.length !== g.fleets.length) {
    g.fleets = alive;
    changed = true;
  }
  if (changed) g.rev++;
}
