import { guardPacked } from '../packedGuard';
import { CombatC, ShipC, type Faction, type Ship } from '../combat/components';
import { factionsHostile } from '../combat/factions';
import { spawnShip } from '../combat/ships';
import { placementGapError } from '../regions';
import { generateShip } from '../shipgen/generate';
import { Rng } from '../rng';
import type { Sim } from '../sim';
import type { ArriveReason } from '../events';
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
import { isProvoked } from './groups';

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

export const GENERATED_CAP = GENERATED_MAX;
/** The memo key of a contact's ship: the generator faction, seed and depth are all `generateShip` reads besides content. */
export const contactKey = (c: Contact): string => `${c.shipgen}|${c.seed}|${c.depth}`;
/** Is the contact's ship already in the memo (generated, or known not to generate)? */
export const isGenerated = (sim: Sim, c: Contact): boolean => generated(sim).has(contactKey(c));

/** The memoised ship of a contact without generating or touching its place in the order (undefined: not there). */
export const peekGenerated = (sim: Sim, c: Contact): ReturnType<typeof generateShip> | null | undefined => generated(sim).get(contactKey(c));

/** The contact's generated ship from the memo (most recently used last), generating and remembering it on a miss. Null when it cannot be generated. */
function shipFor(sim: Sim, c: Contact, def: NonNullable<Sim['content']['factions']>[string]): ReturnType<typeof generateShip> | null {
  const memo = generated(sim);
  const key = contactKey(c);
  let gen = memo.get(key);
  if (gen !== undefined) {
    memo.delete(key);
    memo.set(key, gen);
    return gen;
  }
  try {
    gen = generateShip(def, c.shipgen, c.seed, c.depth, sim.content.modules);
  } catch {
    gen = null;
  }
  return remember(sim, key, gen); // a ship with problems is refused, as when it was warmed first
}

/** Put a generated ship (or null: it cannot be generated) in the memo, forgetting the least recently used one over the cap. A ship with problems counts as null. */
function remember(sim: Sim, key: string, gen: ReturnType<typeof generateShip> | null): ReturnType<typeof generateShip> | null {
  const memo = generated(sim);
  const ok = gen && gen.problems.length === 0 ? gen : null;
  memo.set(key, ok);
  if (memo.size > GENERATED_MAX) memo.delete(memo.keys().next().value as string);
  return ok;
}

/** Contact keys whose ship is being generated off the sim thread (see `claimGeneration`), per content registry. */
const claimed = new WeakMap<object, Set<string>>();
const claims = (sim: Sim): Set<string> => {
  let s = claimed.get(sim.content);
  if (!s) claimed.set(sim.content, (s = new Set()));
  return s;
};

/**
 * Take on generating a contact's ship somewhere else (a worker: `generateShip` takes tens of ms, a stall when it runs between frames). While
 * claimed, `warmContact` leaves the ship alone; the claimer hands the result in with `provideGenerated`, or gives up with `releaseGeneration`.
 * A ship needed before it is provided is generated on the spot as ever (`spawnContact`). False when the ship is already in the memo or claimed.
 */
export function claimGeneration(sim: Sim, c: Contact): boolean {
  const key = contactKey(c);
  if (!sim.content.factions?.[c.shipgen] || generated(sim).has(key) || claims(sim).has(key)) return false;
  claims(sim).add(key);
  return true;
}

/** Hand in the ship of a claimed contact: exactly what `generateShip` gives for it (generation is a pure function of the contact's key). */
export function provideGenerated(sim: Sim, c: Contact, gen: ReturnType<typeof generateShip> | null): void {
  const key = contactKey(c);
  claims(sim).delete(key);
  if (c.ship === undefined && !generated(sim).has(key)) remember(sim, key, gen); // a ship that has already turned up needs nothing
}

/**
 * Ships are warmed somewhere else (the app's worker prewarm): `warmFleets` leaves every candidate to it instead of racing it a ship a second,
 * which at high game speed beat the worker's scan to most of them and generated them between frames. Off again when the worker fails. Per
 * content registry, like the memo; touches no sim state (warming only fills the memo).
 */
const elsewhere = new WeakSet<object>();
export function warmElsewhere(sim: Sim, on: boolean): void {
  if (on) elsewhere.add(sim.content);
  else elsewhere.delete(sim.content);
}
export const isWarmedElsewhere = (sim: Sim): boolean => elsewhere.has(sim.content);

/** Give up a claim (the generator failed): `warmContact` may generate the ship itself again. */
export function releaseGeneration(sim: Sim, c: Contact): void {
  claims(sim).delete(contactKey(c));
}

/**
 * Generate a contact's ship into the memo ahead of its arrival (fleetShips.ts `warmFleets`). Touches nothing but the memo: no Rng, no sim state.
 * False when it was already there or its generator faction is missing.
 */
export function warmContact(sim: Sim, c: Contact): boolean {
  const def = sim.content.factions?.[c.shipgen];
  if (!def || isGenerated(sim, c) || claims(sim).has(contactKey(c))) return false;
  shipFor(sim, c, def);
  return true;
}

/** The player's flown ship (lowest id) with its components: active, player faction, with combat state. Trade's `playerShip` returns just the id. */
export function playerShipInfo(sim: Sim): { id: number; ship: Ship } | null {
  guardPacked(sim, 'playerShipInfo');
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
export function freeSpot(sim: Sim, w: number, h: number): { x: number; y: number } | null {
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
 * faction's combat side, the rest neutral (a scene may set the side, and cap the crew); one the player provoked always comes back hostile. Returns false (the contact stays, unspawned) when its
 * generator faction is missing, no layout comes out or nothing fits. Reports `ship.arrived` (with `opts.reason`, default 'spawn'), so every way a ship turns up here is covered.
 */
export function spawnContact(sim: Sim, node: string, c: Contact, opts: { side?: Faction; crew?: number; reason?: ArriveReason } = {}): boolean {
  if (sim.galaxy.current !== node || c.ship !== undefined) return false;
  const def = sim.content.factions?.[c.shipgen];
  if (!def) return false;
  const key = contactKey(c);
  const gen = shipFor(sim, c, def);
  if (!gen) return false;
  const spot = freeSpot(sim, gen.width, gen.height);
  if (!spot) return false;
  generated(sim).delete(key);
  // A hired escort fights for whoever pays it.
  const payer = c.hired ?? c.faction;
  const sideOf = (f: string): Faction => sim.content.galaxy?.factions[f]?.combatFaction ?? 'hostile';
  // Provoked, it is on its owner's combat side as provoke() put it (combat/provoke.ts).
  const side = isProvoked(sim, c) ? sideOf(c.faction) : opts.side ?? (isHostileFaction(sim, payer) ? sideOf(payer) : 'neutral');
  // A scene may ask for fewer crew than the generator puts aboard (the first `crew` of them).
  const template = opts.crew === undefined ? gen.template : { ...gen.template, crew: (gen.template.crew ?? []).slice(0, opts.crew) };
  const id = spawnShip(sim, template, { faction: side, x: spot.x, y: spot.y, rest: 100, gen: { faction: c.shipgen, seed: c.seed, depth: c.depth, owner: c.faction, ...(gen.role ? { role: gen.role } : {}) } });
  const ship = sim.world.get(id, ShipC);
  if (ship) {
    if (c.name) ship.name = c.name;
    if (c.bounty !== undefined) ship.bounty = c.bounty;
  }
  c.ship = id;
  sim.galaxy.rev++;
  if (ship) sim.events.emit({ type: 'ship.arrived', node, ship: id, name: ship.name, faction: ship.faction, owner: c.faction, reason: opts.reason ?? 'spawn', x: ship.x + ship.width / 2, y: ship.y + ship.height / 2 });
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
  const { p, pool } = arrivalPool(sim, node);
  const roll = withGalaxyRng(g, (rng) => drawArrival(rng, p));
  if (!roll.hit || !pool.length) return;
  const c: Contact = { id: g.nextId++, ...arrivalShip(sim, pool, roll, node.danger), since: sim.tick };
  st.contacts.push(c);
  g.rev++;
  if (!spawnContact(sim, node.id, c, { reason: 'jump-in' })) sim.events.emit({ type: 'ship.arrived', node: node.id, ship: null, name: '', faction: null, owner: c.faction, reason: 'jump-in', x: 0, y: 0 });
}

/** The arrival chance at the node and the factions that may arrive (weighted), as the roll reads them. */
function arrivalPool(sim: Sim, node: NonNullable<ReturnType<typeof currentNode>>): { p: number; pool: { value: string; weight: number }[] } {
  let p = arrivalChance(sim);
  const content = sim.content.galaxy;
  let pool = trafficPool(content, node.faction, node.danger).filter((w) => isHostileFaction(sim, w.value));
  if (!pool.length && node.danger <= SCAVENGER_MAX_DANGER && content?.factions[SCAVENGER_FACTION] && isHostileFaction(sim, SCAVENGER_FACTION)) {
    pool = [{ value: SCAVENGER_FACTION, weight: 1 }];
    p = Math.max(p, SCAVENGER_CHANCE);
  }
  return { p, pool };
}

/** One arrival roll's draws from the galaxy Rng, in their order. */
function drawArrival(rng: Rng, p: number): { hit: boolean; who: number; ship: number; seed: number } {
  return { hit: rng.next() < p, who: rng.next(), ship: rng.next(), seed: rng.int(0, 0x7fffffff) };
}

/** Who a roll brings: the faction from the pool, its generator faction and seed. */
function arrivalShip(sim: Sim, pool: { value: string; weight: number }[], roll: { who: number; ship: number; seed: number }, depth: number): Omit<Contact, 'id' | 'since'> {
  const faction = pickWeighted(pool, roll.who) as string;
  const shipgen = pickWeighted(sim.content.galaxy?.factions[faction]?.ships ?? [], roll.ship) ?? '';
  return { faction, shipgen, seed: roll.seed, depth };
}

/**
 * The ship the next arrival roll brings if it hits, as things stand: the galaxy Rng serves only that roll, so its draws are known now. Reads
 * only (the Rng state is copied). For generating that ship ahead (app/prewarm.ts) so a jump-in does not stall a tick on `generateShip`; a
 * wrong guess (the node or standings changed first) costs nothing but the work. Null when no arrival can come.
 */
export function nextArrival(sim: Sim): Contact | null {
  const node = currentNode(sim);
  if (!node || sim.sector.state !== 'active') return null;
  const { p, pool } = arrivalPool(sim, node);
  if (!pool.length || p <= 0) return null;
  const c: Contact = { id: -1, ...arrivalShip(sim, pool, drawArrival(new Rng(sim.galaxy.rng), p), node.danger), since: sim.tick };
  return sim.content.factions?.[c.shipgen] ? c : null;
}
