import { CombatC, ShipC, type Ship } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import { spawnShip } from '../combat/ships';
import { placementGapError } from '../regions';
import { generateShip } from '../shipgen/generate';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { graceHolds } from './grace';
import { pickWeighted, trafficPool } from './sector';
import { isHostileFaction, tierOf } from './standing';
import { currentNode, nodeState, withGalaxyRng } from './state';
import {
  ARRIVAL_EVERY_SEC, ARRIVAL_FRIENDLY_TERRITORY, ARRIVAL_HOSTILE_TERRITORY, ARRIVAL_MAX_CHANCE, ARRIVAL_PER_DANGER,
  MAX_HOSTILE_CONTACTS,
} from './tuning';
import { SCAVENGER_CHANCE, SCAVENGER_FACTION, SCAVENGER_MAX_DANGER } from './tuningHeat';
import type { Contact } from './types';

/**
 * Generated ships by contact key (faction shipgen, seed, depth), per content registry. Generation is a pure function of the key, so
 * a contact that finds no room (retried every second by fleets and arrivals) reuses its ship instead of generating it again; a key
 * that cannot be generated is remembered as null. An entry goes once its ship is placed. Not saved: a cache, rebuilt on demand.
 */
const generatedShips = new WeakMap<object, Map<string, ReturnType<typeof generateShip> | null>>();
const GENERATED_MAX = 64;
function generated(sim: Sim): Map<string, ReturnType<typeof generateShip> | null> {
  let m = generatedShips.get(sim.content);
  if (!m) generatedShips.set(sim.content, (m = new Map()));
  return m;
}

/** The player's flown ship (lowest id) with its components: active, player faction, with combat state. Trade's `playerShip` returns just the id. */
export function playerShipInfo(sim: Sim): { id: number; ship: Ship } | null {
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC) as Ship;
    if (ship.faction === 'player' && ship.state === 'active') return { id, ship };
  }
  return null;
}

/** Distances (tiles between ship centres) and directions tried, in order, when placing a ship that appears in the node. */
const SPOT_RINGS = [70, 95, 125, 160];
const SPOT_DIRS = 12;

/**
 * Where a ship of w x h tiles appears: the first spot on rings around the player's ship that passes the same checks as
 * `sector.deploy` (inside the sector bounds, then the gap rule `placementGapError`). Null when nothing fits. Deterministic.
 */
function freeSpot(sim: Sim, w: number, h: number): { x: number; y: number } | null {
  const me = playerShipInfo(sim)?.ship;
  const cx = me ? me.x + me.width / 2 : sim.sector.width / 2;
  const cy = me ? me.y + me.height / 2 : sim.sector.height / 2;
  for (const r of SPOT_RINGS) {
    for (let k = 0; k < SPOT_DIRS; k++) {
      const a = (k * 2 * Math.PI) / SPOT_DIRS;
      const x = Math.round(cx + r * Math.cos(a) - w / 2);
      const y = Math.round(cy + r * 0.6 * Math.sin(a) - h / 2);
      if (x < 0 || y < 0 || x + w > sim.sector.width || y + h > sim.sector.height) continue;
      if (!placementGapError(sim, { x, y, w, h })) return { x, y };
    }
  }
  return null;
}

/**
 * Make a contact a real ship in the active sector through the generated-ship path and the gap rule: hostile ones on their
 * faction's combat side, the rest neutral. Returns false (the contact stays, unspawned) when its
 * generator faction is missing, no layout comes out or nothing fits.
 */
export function spawnContact(sim: Sim, node: string, c: Contact): boolean {
  if (sim.galaxy.current !== node || c.ship !== undefined) return false;
  const def = sim.content.factions?.[c.shipgen];
  if (!def) return false;
  const key = `${c.shipgen}|${c.seed}|${c.depth}`;
  const memo = generated(sim);
  let gen = memo.get(key);
  if (gen === undefined) {
    try {
      gen = generateShip(def, c.shipgen, c.seed, c.depth, sim.content.modules);
    } catch {
      gen = null;
    }
    if (gen && gen.problems.length > 0) gen = null;
    memo.set(key, gen);
    if (memo.size > GENERATED_MAX) memo.delete(memo.keys().next().value as string);
  }
  if (!gen) return false;
  const spot = freeSpot(sim, gen.width, gen.height);
  if (!spot) return false;
  memo.delete(key);
  // A hired escort fights for whoever pays it.
  const payer = c.hired ?? c.faction;
  const side = isHostileFaction(sim, payer) ? sim.content.galaxy?.factions[payer]?.combatFaction ?? 'hostile' : 'neutral';
  const id = spawnShip(sim, gen.template, { faction: side, x: spot.x, y: spot.y, rest: 100 });
  const ship = sim.world.get(id, ShipC);
  if (ship) {
    ship.gen = { faction: c.shipgen, seed: c.seed, depth: c.depth, owner: c.faction };
    if (c.name) ship.name = c.name;
    if (c.bounty !== undefined) ship.bounty = c.bounty;
  }
  c.ship = id;
  sim.galaxy.rev++;
  sim.events.emit({ type: 'galaxy.shipArrived', node, faction: c.faction, ship: id });
  return true;
}

/** Drop contacts whose spawned ship is gone, wrecked, fled or taken. */
export function pruneContacts(sim: Sim): void {
  const st = sim.galaxy.nodes[sim.galaxy.current];
  if (!st) return;
  const before = st.contacts.length;
  st.contacts = st.contacts.filter((c) => {
    if (c.ship === undefined) return true;
    const s = sim.world.get(c.ship, ShipC);
    return !!s && (s.state === 'active' || s.state === 'disabled');
  });
  if (st.contacts.length !== before) sim.galaxy.rev++;
}

/** Chance per roll that a hostile ship jumps into the current node. */
function arrivalChance(sim: Sim): number {
  const node = currentNode(sim);
  if (!node) return 0;
  let p = Math.min(ARRIVAL_MAX_CHANCE, ARRIVAL_PER_DANGER * node.danger);
  if (node.faction) {
    const tier = tierOf(sim, node.faction);
    if (tier === 'hostile') p *= ARRIVAL_HOSTILE_TERRITORY;
    if (tier === 'friendly') p *= ARRIVAL_FRIENDLY_TERRITORY;
  }
  return Math.min(1, p);
}

/**
 * Hostile ships in the active sector, for the arrival cap: the live ships themselves (a revisited node's archive brings its ships
 * back without descriptors), plus descriptors that never found room to spawn.
 */
function hostileShipsHere(sim: Sim, contacts: readonly Contact[]): number {
  let n = contacts.filter((c) => c.ship === undefined && isHostileFaction(sim, c.faction)).length;
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s && (s.state === 'active' || s.state === 'disabled') && factionsHostile(s.faction, 'player')) n++;
  }
  return n;
}

/**
 * The arrival roll while the player stays: every ARRIVAL_EVERY_SEC, with `arrivalChance`, a ship of a faction hostile to
 * the player (drawn from the node's traffic pool) jumps in and is spawned. Where the pool holds nobody hostile near the start (danger up to
 * SCAVENGER_MAX_DANGER), a lone scavenger still turns up with chance SCAVENGER_CHANCE, so the first hours are not empty (#45). Uses the galaxy's own Rng.
 */
export function rollArrival(sim: Sim): void {
  const g = sim.galaxy;
  if (sim.sector.state !== 'active' || sim.tick < g.nextArrival) return;
  g.nextArrival = sim.tick + Math.round(ARRIVAL_EVERY_SEC * TICK_HZ);
  const node = currentNode(sim);
  if (!node || !playerShipInfo(sim) || graceHolds(sim, node.id)) return;
  const st = nodeState(sim, node.id);
  if (hostileShipsHere(sim, st.contacts) >= MAX_HOSTILE_CONTACTS) return;
  let p = arrivalChance(sim);
  const content = sim.content.galaxy;
  let pool = trafficPool(content, node.faction, node.danger).filter((w) => isHostileFaction(sim, w.value));
  if (!pool.length && node.danger <= SCAVENGER_MAX_DANGER && content?.factions[SCAVENGER_FACTION] && isHostileFaction(sim, SCAVENGER_FACTION)) {
    pool = [{ value: SCAVENGER_FACTION, weight: 1 }];
    p = Math.max(p, SCAVENGER_CHANCE);
  }
  const roll = withGalaxyRng(g, (rng) => ({ hit: rng.next() < p, who: rng.next(), ship: rng.next(), seed: rng.int(0, 0x7fffffff) }));
  if (!roll.hit || !pool.length) return;
  const faction = pickWeighted(pool, roll.who) as string;
  const shipgen = pickWeighted(content?.factions[faction]?.ships ?? [], roll.ship) ?? '';
  const c: Contact = { id: g.nextId++, faction, shipgen, seed: roll.seed, depth: node.danger, since: sim.tick };
  st.contacts.push(c);
  g.rev++;
  if (!spawnContact(sim, node.id, c)) sim.events.emit({ type: 'galaxy.shipArrived', node: node.id, faction, ship: null });
}
