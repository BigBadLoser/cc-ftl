import { CombatC, ShipC, type Ship } from '../combat/components';
import { spawnShip } from '../combat/ships';
import { placementGapError } from '../regions';
import { generateShip } from '../shipgen/generate';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { pickWeighted, trafficPool } from './sector';
import { isHostileFaction, tierOf } from './standing';
import { currentNode, nodeState, withGalaxyRng } from './state';
import {
  ARRIVAL_EVERY_SEC, ARRIVAL_FRIENDLY_TERRITORY, ARRIVAL_HOSTILE_TERRITORY, ARRIVAL_MAX_CHANCE, ARRIVAL_PER_DANGER,
  MAX_HOSTILE_CONTACTS,
} from './tuning';
import type { Contact } from './types';

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
 * faction's combat side, the rest neutral. Returns false (the contact stays, unspawned) when the sector is not active, its
 * generator faction is missing, no layout comes out or nothing fits.
 */
export function spawnContact(sim: Sim, node: string, c: Contact): boolean {
  if (sim.sector.state !== 'active' || sim.galaxy.current !== node || c.ship !== undefined) return false;
  const def = sim.content.factions?.[c.shipgen];
  if (!def) return false;
  let gen: ReturnType<typeof generateShip>;
  try {
    gen = generateShip(def, c.shipgen, c.seed, c.depth, sim.content.modules);
  } catch {
    return false;
  }
  if (gen.problems.length > 0) return false;
  const spot = freeSpot(sim, gen.width, gen.height);
  if (!spot) return false;
  const side = isHostileFaction(sim, c.faction) ? sim.content.galaxy?.factions[c.faction]?.combatFaction ?? 'hostile' : 'neutral';
  const id = spawnShip(sim, gen.template, { faction: side, x: spot.x, y: spot.y, rest: 100 });
  const ship = sim.world.get(id, ShipC);
  if (ship) ship.gen = { faction: c.shipgen, seed: c.seed, depth: c.depth };
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
 * The arrival roll while the player stays: every ARRIVAL_EVERY_SEC, with `arrivalChance`, a ship of a faction hostile to
 * the player (drawn from the node's traffic pool) jumps in and is spawned. Uses the galaxy's own Rng.
 */
export function rollArrival(sim: Sim): void {
  const g = sim.galaxy;
  if (sim.sector.state !== 'active' || sim.tick < g.nextArrival) return;
  g.nextArrival = sim.tick + Math.round(ARRIVAL_EVERY_SEC * TICK_HZ);
  const node = currentNode(sim);
  if (!node || !playerShipInfo(sim)) return;
  const st = nodeState(sim, node.id);
  if (st.contacts.filter((c) => isHostileFaction(sim, c.faction)).length >= MAX_HOSTILE_CONTACTS) return;
  const p = arrivalChance(sim);
  const content = sim.content.galaxy;
  const pool = trafficPool(content, node.faction, node.danger).filter((w) => isHostileFaction(sim, w.value));
  const roll = withGalaxyRng(g, (rng) => ({ hit: rng.next() < p, who: rng.next(), ship: rng.next(), seed: rng.int(0, 0x7fffffff) }));
  if (!roll.hit || !pool.length) return;
  const faction = pickWeighted(pool, roll.who) as string;
  const shipgen = pickWeighted(content?.factions[faction]?.ships ?? [], roll.ship) ?? '';
  const c: Contact = { id: g.nextId++, faction, shipgen, seed: roll.seed, depth: node.danger, since: sim.tick };
  st.contacts.push(c);
  g.rev++;
  if (!spawnContact(sim, node.id, c)) sim.events.emit({ type: 'galaxy.shipArrived', node: node.id, faction, ship: null });
}
