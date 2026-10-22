import type { Sim } from '../sim';
import { isLive } from '../trade/deals';
import { hash32, unit } from './hash';
import { fleetRoleOf, liftFleet, materialiseFleet } from './fleetShips';
import { planStarRoute } from './route';
import { pickWeighted, trafficPool } from './sector';
import { galaxyIndex } from './state';
import {
  FLEET_AREA_HOPS, FLEET_CAP, FLEET_DAMAGED_CHANCE, FLEET_DWELL, FLEET_MAX_SHIPS, FLEET_SPAWN_CHANCE, FLEET_SPAWN_TRIES,
  FLEET_STATION_WEIGHT, FLEET_TRIP_HOPS, FLEET_TTL, SENSOR_HOPS,
} from './tuning';
import type { Contact, Fleet } from './types';

/**
 * NPC traffic (user decisions 2026-10-22): fleets travel the starmap one hop per turn along the planned route, and are the same
 * ships that show up in a node the player is in (fleetShips.ts). Everything here is a pure function of the galaxy seed, the turn
 * number and the galaxy state, so a run and a save continuation agree. Spawn, trips and despawns use `unit(seed, turn, ...)`
 * hashes, never the galaxy Rng.
 */

/** Node ids within `hops` jumps of `from` over generated edges, with their distance. */
export function nodesWithin(sim: Sim, from: string, hops: number): Map<string, number> {
  const index = galaxyIndex(sim.galaxy);
  const out = new Map<string, number>();
  if (!index.nodes.has(from)) return out;
  out.set(from, 0);
  let frontier = [from];
  for (let h = 1; h <= hops && frontier.length; h++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of index.adjacent.get(id) ?? []) {
        const o = e.a === id ? e.b : e.a;
        if (out.has(o)) continue;
        out.set(o, h);
        next.push(o);
      }
    }
    frontier = next.sort();
  }
  return out;
}

/** Nodes the player's sensors cover: within SENSOR_HOPS jumps of the current node. Fleets elsewhere are not shown. */
export const sensorNodes = (sim: Sim): Map<string, number> => nodesWithin(sim, sim.galaxy.current, SENSOR_HOPS);

/** The fleets the player's sensors can see, ascending id. */
export const visibleFleets = (sim: Sim): Fleet[] => {
  const seen = sensorNodes(sim);
  return sim.galaxy.fleets.filter((f) => seen.has(f.node));
};

const hasStation = (sim: Sim, id: string): boolean =>
  (galaxyIndex(sim.galaxy).nodes.get(id)?.structures ?? []).some((s) => sim.content.galaxy?.structures[s.def]?.kind === 'station');

/** Pick one id by weight (stations count FLEET_STATION_WEIGHT times a plain node, or the reverse for `invert`) with `u` in [0, 1). */
function pickNode(sim: Sim, ids: readonly string[], u: number, invert = false): string | null {
  const pool = ids.map((id) => ({ value: id, weight: hasStation(sim, id) !== invert ? FLEET_STATION_WEIGHT : 1 }));
  return pickWeighted(pool, u);
}

const intIn = (r: { readonly min: number; readonly max: number }, u: number): number => r.min + Math.floor(u * (r.max - r.min + 1));

/** Plan a new trip from the fleet's node: a destination `FLEET_TRIP_HOPS` away (traders and patrols like stations, raiders do not). Empty route when none. */
function newTrip(sim: Sim, f: Fleet, salt: number): void {
  const near = nodesWithin(sim, f.node, FLEET_TRIP_HOPS.max);
  const area = nodesWithin(sim, sim.galaxy.current, FLEET_AREA_HOPS);
  const ids = [...near.keys()].filter((id) => (near.get(id) as number) >= FLEET_TRIP_HOPS.min && area.has(id)).sort();
  const dest = pickNode(sim, ids, unit(sim.seed, f.id, salt, 31), f.role === 'pirate' || f.role === 'raider');
  const plan = dest ? planStarRoute(sim.galaxy, f.node, dest, { known: false }) : null;
  f.route = plan ? plan.path.slice(1) : [];
  f.dest = plan ? dest ?? f.node : f.node;
}

/** Try to make the fleet number `k` of turn `turn`; null when nothing fits (no origin, no ships for the faction). */
function makeFleet(sim: Sim, turn: number, k: number): Fleet | null {
  const g = sim.galaxy;
  const content = sim.content.galaxy;
  if (!content) return null;
  const h = (salt: number): number => unit(sim.seed, turn, k, salt);
  const area = [...nodesWithin(sim, g.current, FLEET_AREA_HOPS).keys()].filter((id) => id !== g.current).sort();
  const origin = pickNode(sim, area, h(1));
  const node = origin ? galaxyIndex(g).nodes.get(origin) : undefined;
  if (!origin || !node) return null;
  const owner = node.structures.find((s) => s.owner && content.structures[s.def]?.kind === 'station')?.owner ?? null;
  const pool = trafficPool(content, node.faction, node.danger);
  const faction = owner && h(2) < 0.6 ? owner : pickWeighted(pool, h(3));
  const def = faction ? content.factions[faction] : undefined;
  if (!faction || !def || !def.ships.length) return null;
  const id = g.nextFleet++;
  const ships: Contact[] = [];
  const count = 1 + Math.floor(h(4) * FLEET_MAX_SHIPS);
  for (let i = 0; i < count; i++) {
    const shipgen = pickWeighted(def.ships, h(10 + i)) ?? '';
    ships.push({ id: g.nextFleet++, faction, shipgen, seed: hash32(sim.seed, turn, k, 50 + i) & 0x7fffffff, depth: node.danger, since: sim.tick });
  }
  const damaged = h(5) < FLEET_DAMAGED_CHANCE;
  const f: Fleet = {
    id, faction, role: fleetRoleOf(def.kind, h(6)), ships, node: origin, from: origin, moved: -1, route: [], dest: origin,
    dwell: 0, ttl: intIn(FLEET_TTL, h(7)), ...(damaged ? { damaged: true as const } : {}),
  };
  if (!damaged) newTrip(sim, f, turn);
  return f;
}

/** Fleets spawned now, up to the cap: `tries` attempts of FLEET_SPAWN_CHANCE each. */
export function spawnFleets(sim: Sim, turn: number, tries: number, chance = FLEET_SPAWN_CHANCE): void {
  const g = sim.galaxy;
  if (!sim.content.galaxy) return;
  for (let k = 0; k < tries && g.fleets.length < FLEET_CAP; k++) {
    if (unit(sim.seed, turn, k, 99) >= chance) continue;
    const f = makeFleet(sim, turn, k);
    if (f) g.fleets.push(f);
  }
}

/** New game: a first batch of fleets so the map has traffic on the first turn. */
export function seedFleets(sim: Sim): void {
  spawnFleets(sim, 0, FLEET_CAP * 2, 0.5);
}

/** A fight or a deal in the player's node keeps the fleets there in place. */
const holdsFleets = (sim: Sim): boolean => sim.sector.inCombat || sim.trade.deals.some(isLive);

/** Move the fleet one step: rest, follow the route, or set out on a new trip. */
function advance(sim: Sim, f: Fleet, turn: number): void {
  if (f.dwell > 0) {
    f.dwell--;
    return;
  }
  if (!f.route.length) {
    newTrip(sim, f, turn);
    if (!f.route.length) {
      f.dwell = 1;
      return;
    }
  }
  f.node = f.route.shift() as string;
  f.moved = turn;
  if (!f.route.length) f.dwell = intIn(FLEET_DWELL, unit(sim.seed, f.id, turn, 11));
}

/**
 * One turn of traffic: every fleet takes a step (unless held in the player's node by a fight or a deal), fleets that ran out of
 * time at their destination or strayed out of the area are removed, and new ones may spawn. When the player's node is live
 * ('active') a fleet that leaves it has its ships lifted out and one that arrives has them materialised there.
 */
export function stepFleets(sim: Sim, turn: number): void {
  const g = sim.galaxy;
  if (!sim.content.galaxy) return;
  const live = sim.sector.state === 'active';
  const area = nodesWithin(sim, g.current, FLEET_AREA_HOPS);
  const keep: Fleet[] = [];
  for (const f of g.fleets) {
    f.from = f.node;
    const here = live && f.node === g.current;
    if (here && holdsFleets(sim)) {
      keep.push(f);
      continue;
    }
    f.ttl--;
    if (!area.has(f.node) || (f.ttl <= 0 && !f.route.length)) {
      if (here) liftFleet(sim, f);
      continue;
    }
    if (!f.damaged) advance(sim, f, turn);
    if (live && here && f.node !== g.current) liftFleet(sim, f);
    else if (live && !here && f.node === g.current) materialiseFleet(sim, f);
    keep.push(f);
  }
  g.fleets = keep;
  spawnFleets(sim, turn, FLEET_SPAWN_TRIES);
  g.rev++;
}
