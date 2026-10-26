import { ShipC } from '../combat/components';
import { liftShip } from '../sector/packet';
import type { Sim } from '../sim';
import { retreat, strand } from './agenda';
import { spawnContact } from './arrivals';
import { graceHolds } from './grace';
import { owe } from './portIndex';
import { FLEET_NODE_SHIPS, STRANDED_INTEGRITY } from './tuning';
import type { Contact, Fleet } from './types';

/**
 * A fleet's ships in the player's node. Fleets are descriptors everywhere; only in the node the player is in do their ships become real
 * (`materialiseFleet`), and they are lifted out again when the fleet or the player leaves (`liftFleet`). What happened to a ship while it was real
 * decides its fate (`reap`): still in play, escaped (fled), or gone (wrecked, taken). A gone ship is forgotten and its home port owes a replacement
 * (portIndex.ts `owe`); the fleet is gone when it has no ship left. Nothing else ever removes a ship.
 */
type Fate = 'present' | 'fled' | 'gone';

function fateOf(sim: Sim, id: number): Fate {
  const s = sim.world.get(id, ShipC);
  if (!s || s.faction === 'player') return 'gone';
  if (s.state === 'active' || s.state === 'disabled') return 'present';
  return s.state === 'fled' ? 'fled' : 'gone';
}

/** Is the fleet's ship still a ship in play (not wrecked, fled, taken or gone)? */
export const inPlay = (sim: Sim, id: number): boolean => fateOf(sim, id) === 'present';

/** Ships in the sector other than the player's that are still in play: the room the node has left for arrivals. */
function shipsInPlay(sim: Sim): number {
  return sim.world.query(ShipC).filter((id) => {
    const s = sim.world.get(id, ShipC);
    return !!s && s.faction !== 'player' && (s.state === 'active' || s.state === 'disabled');
  }).length;
}

/**
 * The fleet is at the player's active node: make its ships real through the node-contact path (`spawnContact`: the faction's
 * generator, the deploy bounds and the gap rule; `node` is the galaxy node the sector stands for, the fleet's own unless it is met elsewhere, as in an
 * event grid), up to FLEET_NODE_SHIPS ships in the sector. Ships that find no room stay descriptors and are retried by `tendFleets`.
 */
export function materialiseFleet(sim: Sim, f: Fleet, node: string = f.node): void {
  if (node === f.node && !sim.galaxy.event && graceHolds(sim, node, f.faction)) return; // opening grace: it stays a descriptor
  for (const c of f.ships) if (c.ship === undefined && shipsInPlay(sim) < FLEET_NODE_SHIPS) spawnContact(sim, node, c);
}

/**
 * Forget the fleet's ships that are gone, owing their port a replacement each, and take out those that escaped (state 'fled'; their entities are
 * lifted away). Returns both. The escaped are no longer in `f.ships`: the caller decides what becomes of them.
 */
export function reap(sim: Sim, f: Fleet): { lost: Contact[]; fled: Contact[] } {
  const lost: Contact[] = [];
  const fled: Contact[] = [];
  f.ships = f.ships.filter((c) => {
    if (c.ship === undefined) return true;
    const fate = fateOf(sim, c.ship);
    if (fate === 'present') return true;
    if (fate === 'fled') {
      liftShip(sim, c.ship);
      fled.push(c);
    } else {
      lost.push(c);
    }
    c.ship = undefined;
    return false;
  });
  for (const c of lost) owe(sim, f.home, f.faction, f.role, c.size ?? 'small', sim.galaxy.turn);
  if (lost.length) sim.galaxy.rev++;
  return { lost, fled };
}

/** A ship in play that is disabled or barely holding together leaves its fleet stranded (real damage: the fleet calls for help until repaired). */
export function strandIfCrippled(sim: Sim, f: Fleet, turn: number): void {
  if (f.damaged) return;
  const crippled = f.ships.some((c) => {
    const s = c.ship === undefined ? undefined : sim.world.get(c.ship, ShipC);
    return !!s && (s.state === 'disabled' || s.integrity < STRANDED_INTEGRITY);
  });
  if (crippled) strand(sim, f, turn);
}

/**
 * The fleet leaves the player's node (or the player does): ships in play are lifted out of the sector with `liftShip` (tiles cleared, entities
 * detached) and become descriptors again; wrecked or taken ones are forgotten (and owed), escaped ones stay in the fleet. A crippled ship strands
 * the fleet. The packet is dropped on purpose: damage does not carry over beyond that (a planner's call; `stampPacket` could restore it later).
 * Hails and offers for the lifted ships go too. So a node's archive never holds a fleet's ship, and nothing is duplicated when the player returns.
 */
export function liftFleet(sim: Sim, f: Fleet): void {
  const { fled } = reap(sim, f);
  f.ships.push(...fled);
  strandIfCrippled(sim, f, sim.galaxy.turn);
  const gone = new Set<number>(fled.map((c) => c.id));
  for (const c of f.ships) {
    if (c.ship === undefined) continue;
    liftShip(sim, c.ship);
    gone.add(c.ship);
    c.ship = undefined;
  }
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

/**
 * Forget a fleet's ships that are gone and retry the ones that had no room. A ship that fled takes its fleet home (`retreat`, out of the node) - or,
 * with `escaped` given (an event grid), is handed to that list. True when the fleet changed.
 */
export function tendFleet(sim: Sim, f: Fleet, node: string = f.node, escaped?: Contact[]): boolean {
  const { lost, fled } = reap(sim, f);
  if (fled.length && escaped) escaped.push(...fled);
  else if (fled.length) {
    f.ships.push(...fled);
    liftFleet(sim, f);
    retreat(sim, f, sim.galaxy.turn);
    return true;
  }
  materialiseFleet(sim, f, node);
  return lost.length > 0 || fled.length > 0;
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
