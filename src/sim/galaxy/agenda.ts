import type { Sim } from '../sim';
import { dockPort, onDock, onWork } from './dock';
import { pathTo, reachFrom } from './graph';
import { unit } from './hash';
import { portNode } from './ports';
import { portsAt } from './portIndex';
import { nodeOf } from './state';
import {
  BREAKDOWN_CHANCE, CATCHUP_MAX, FLEET_LEGS, FLEET_LEG_HOPS, FLEET_RANGE, FLEET_REST, FLEET_WORK, REPAIR_TURNS,
} from './tuning';
import { fleetPower, wouldFight } from './clash';
import { ARMED, CHASE_HOPS, HUNT_CHANCE, HUNT_EDGE } from './tuningWar';
import type { Fleet } from './types';

/**
 * What a fleet does with its turns (simple, turn-based, one hop per turn). Every fleet rests at its home port, sets out on an outing of a few
 * stops, works a while at each, and comes home again:
 * - traders go from station to station within FLEET_RANGE of home and dwell at each (stage 3 hangs buying and selling on `onDock`);
 * - miners go to an asteroid field near home, work it and come back;
 * - patrols cycle the nodes of their own faction's territory around home;
 * - pirates and raiders prowl the nodes within a few jumps of their den or nest.
 * `stepAgenda` is a pure function of the fleet, the map and (seed, fleet id, turn) hashes - never an Rng - so it can be replayed:
 * `catchUp` plays a fleet that was not stepped forward to the present, exactly as if it had been stepped, for up to CATCHUP_MAX turns.
 */
const SALT = { rest: 11, legs: 12, target: 13, work: 14, breakdown: 15, repair: 16, reset: 17, hunt: 18 } as const;

const intIn = (r: { readonly min: number; readonly max: number }, u: number): number => r.min + Math.floor(u * (r.max - r.min + 1));
const rnd = (sim: Sim, f: Fleet, turn: number, salt: number): number => unit(sim.seed, f.id, turn, salt);

/** Does the node hold a station (a place to trade) or an asteroid field (a place to mine)? */
function structureKinds(sim: Sim, id: string): { station: boolean; ore: boolean } {
  const defs = sim.content.galaxy?.structures;
  const kinds = (nodeOf(sim, id)?.structures ?? []).map((s) => defs?.[s.def]?.kind);
  return { station: kinds.includes('station'), ore: kinds.includes('asteroids') };
}

/** Is the node a stop for this fleet's work? */
function suits(sim: Sim, f: Fleet, id: string): boolean {
  switch (f.role) {
    case 'trader': return structureKinds(sim, id).station;
    case 'miner': return structureKinds(sim, id).ore;
    case 'patrol': return nodeOf(sim, id)?.faction === f.faction;
    default: return true;
  }
}

/** Where the fleet can go next: stops of its work within FLEET_LEG_HOPS of here and FLEET_RANGE of home, nearest first (`any`: wherever, for a hunt). */
function targets(sim: Sim, f: Fleet, any = false): string[] {
  const here = reachFrom(sim, f.node);
  const base = reachFrom(sim, portNode(f.home));
  const out: string[] = [];
  for (const id of here.order) {
    const d = here.dist.get(id) as number;
    if (d > FLEET_LEG_HOPS) break;
    if (d > 0 && (base.dist.get(id) ?? Infinity) <= FLEET_RANGE[f.role] && (any || suits(sim, f, id))) out.push(id);
  }
  return out;
}

/**
 * Armed fleets go where the quarry is: a patrol makes for a pirate or raider it can take, a pirate for a trader or miner (never a patrol that would drive it off),
 * within its usual range, with chance HUNT_CHANCE per leg. The quarry's place is the state of the world when the leg is planned (fleets go in id order).
 */
function hunt(sim: Sim, f: Fleet, turn: number): string | null {
  if (!ARMED.includes(f.role) || rnd(sim, f, turn, SALT.hunt) >= HUNT_CHANCE) return null;
  const mine = fleetPower(f);
  const here = targets(sim, f, true);
  const prey = new Set<string>();
  for (const g of sim.galaxy.fleets) {
    if (g === f || !g.ships.length || g.node === f.node || !here.includes(g.node) || !wouldFight(sim, f, g)) continue;
    const theirs = fleetPower(g);
    const ok = f.role === 'patrol' ? mine >= HUNT_EDGE * theirs : f.role === 'pirate' ? g.role !== 'patrol' && mine >= HUNT_EDGE * theirs : false;
    if (ok) prey.add(g.node);
  }
  const nodes = here.filter((n) => prey.has(n));
  return nodes.length ? (nodes[Math.floor(rnd(sim, f, turn, SALT.target + 100) * nodes.length)] as string) : null;
}

/** Choose the next stop (miners take one of the three nearest fields), or null when there is none. */
function pickTarget(sim: Sim, f: Fleet, turn: number, wanted?: string): string | null {
  const list = targets(sim, f);
  if (wanted && list.includes(wanted)) return wanted;
  const hunted = hunt(sim, f, turn);
  if (hunted) return hunted;
  const pool = f.role === 'miner' ? list.slice(0, 3) : list;
  return pool.length ? (pool[Math.floor(rnd(sim, f, turn, SALT.target) * pool.length)] as string) : null;
}

/** Plan the next leg: another stop of the outing, the way home, or (at home) a new outing; or rest when there is nowhere to go. */
function plan(sim: Sim, f: Fleet, turn: number): void {
  const home = portNode(f.home);
  let dest: string | null = null;
  const wanted = f.pick;
  delete f.pick;
  if (f.legs > 0) {
    f.legs--;
    dest = pickTarget(sim, f, turn, wanted);
  } else if (f.node !== home) {
    dest = home;
  } else {
    f.legs = intIn(FLEET_LEGS[f.role], rnd(sim, f, turn, SALT.legs));
    dest = pickTarget(sim, f, turn, wanted);
    if (dest) f.legs--;
  }
  if (!dest && f.node !== home) {
    f.legs = 0;
    dest = home;
  }
  f.route = dest ? pathTo(sim, f.node, dest) : [];
  f.dest = f.route.length ? (dest as string) : f.node;
  if (!f.route.length) {
    f.legs = 0;
    f.dwell = intIn(FLEET_REST, rnd(sim, f, turn, SALT.rest));
  }
}

/** The fleet reached the end of its route: dock if there is a port, and rest (at home) or work. */
function arrive(sim: Sim, f: Fleet, turn: number): void {
  const home = f.node === portNode(f.home);
  f.dwell = home ? intIn(FLEET_REST, rnd(sim, f, turn, SALT.rest)) : intIn(FLEET_WORK[f.role], rnd(sim, f, turn, SALT.work));
  const port = dockPort(portsAt(sim, f.node), f.role);
  if (port) onDock(sim, f, port, () => (f.legs > 0 || home ? targets(sim, f) : [portNode(f.home)]));
  else onWork(sim, f);
}

/**
 * A hunter's turn (hunters.ts): past its time it stands down and heads home; otherwise it makes for the player's node, re-planned whenever the player moved.
 * True when it has nothing else to do this turn (it is where the player is).
 */
function huntStep(sim: Sim, f: Fleet, turn: number): boolean {
  const hunt = f.hunt as { until: number };
  if (turn > hunt.until) {
    delete f.hunt;
    f.standDown = true;
    headHome(sim, f);
    return false;
  }
  const to = sim.galaxy.current;
  f.dwell = 0;
  f.legs = 0;
  if (f.dest !== to || !f.route.length) {
    f.route = pathTo(sim, f.node, to);
    f.dest = f.route.length ? to : f.node;
  }
  return !f.route.length;
}

/** Play one turn of the fleet's agenda: `turn` is the turn number being played. Records the move for crossing detection (`from`, `moved`). */
export function stepAgenda(sim: Sim, f: Fleet, turn: number): void {
  f.from = f.node;
  f.synced = turn;
  if (f.damaged) {
    if (--f.dwell <= 0) {
      delete f.damaged;
      f.dwell = 0;
    }
    return;
  }
  if (f.hunt && huntStep(sim, f, turn)) return;
  if (f.dwell > 0) {
    f.dwell--;
    return;
  }
  if (!f.route.length) plan(sim, f, turn);
  if (!f.route.length) return;
  f.node = f.route.shift() as string;
  f.moved = turn;
  if (!f.route.length) arrive(sim, f, turn);
  else if (f.node !== portNode(f.home) && rnd(sim, f, turn, SALT.breakdown) < BREAKDOWN_CHANCE) {
    strand(sim, f, turn);
  }
}

/**
 * Bring a frozen fleet up to turn `to`: its agenda is played turn by turn, as if it had been stepped all along (exact for up to CATCHUP_MAX
 * turns). After a longer absence it is first put back at its home port with a hashed rest, and only the last CATCHUP_MAX turns are played.
 */
export function catchUp(sim: Sim, f: Fleet, to: number): void {
  catchUpFleets(sim, [f], to);
}

/**
 * Bring several frozen fleets up to turn `to` together: turn by turn, every fleet that is behind steps in id order, exactly the order `stepFleets` would
 * have played. That matters because docking trades against shared port markets: one fleet's whole absence played before the next one's would give the
 * second a different market than a stepped run did.
 */
export function catchUpFleets(sim: Sim, fleets: readonly Fleet[], to: number, after?: (turn: number, stepped: readonly Fleet[]) => void): void {
  let behind = fleets.filter((f) => f.synced < to);
  for (const f of behind) {
    if (to - f.synced <= CATCHUP_MAX) continue;
    const home = portNode(f.home);
    Object.assign(f, { node: home, from: home, route: [], dest: home, legs: 0, dwell: intIn(FLEET_REST, rnd(sim, f, to, SALT.reset)), synced: to - CATCHUP_MAX });
    delete f.damaged;
    delete f.cargo;
    delete f.pick;
  }
  const from = behind.reduce((m, f) => Math.min(m, f.synced), to);
  for (let t = from + 1; t <= to; t++) {
    const stepped = behind.filter((f) => f.synced < t);
    for (const f of stepped) stepAgenda(sim, f, t);
    // The turn's meetings (meetings.ts) among the fleets that moved; fleets they destroyed play no further.
    if (after) {
      after(t, stepped);
      behind = behind.filter((f) => f.ships.length > 0);
    }
  }
}

/** The fleet is stranded where it is: it stops and calls for help until it has repaired itself (REPAIR_TURNS) or is helped. */
export function strand(sim: Sim, f: Fleet, turn: number): void {
  f.damaged = true;
  f.route = [];
  f.dest = f.node;
  f.dwell = intIn(REPAIR_TURNS, rnd(sim, f, turn, SALT.repair));
}

/** The fleet runs for home (or, at home, for a neighbouring node and back): one hop now, the rest of the way as its route. */
export function retreat(sim: Sim, f: Fleet, turn: number): void {
  const home = portNode(f.home);
  const path = f.node === home ? [reachFrom(sim, home).order[1], home].filter((n): n is string => !!n) : pathTo(sim, f.node, home);
  if (!path.length) return;
  f.from = f.node;
  f.node = path[0] as string;
  f.moved = turn;
  f.route = path.slice(1);
  f.dest = path[path.length - 1] as string;
  f.legs = 0;
  f.dwell = 0;
}

/** The fleet heads home along the shortest path without moving yet (it already took this turn's step): a pirate with loot, a winner leaving the field. */
export function headHome(sim: Sim, f: Fleet): void {
  const home = portNode(f.home);
  f.legs = 0;
  f.dwell = 0;
  delete f.pick;
  f.route = f.node === home ? [] : pathTo(sim, f.node, home);
  f.dest = f.route.length ? home : f.node;
}

/** The hunter follows the fled `prey` a few hops (CHASE_HOPS) along the way it ran, then goes home as usual (its outing is over). */
export function chase(sim: Sim, hunter: Fleet, prey: Fleet): void {
  const path = [prey.node, ...prey.route].slice(0, CHASE_HOPS);
  hunter.legs = 0;
  hunter.dwell = 0;
  hunter.route = path.filter((n) => n !== hunter.node);
  hunter.dest = hunter.route[hunter.route.length - 1] ?? hunter.node;
}
