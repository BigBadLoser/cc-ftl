import type { Sim } from '../sim';
import { onDock } from './dock';
import { pathTo, reachFrom } from './graph';
import { unit } from './hash';
import { portNode } from './ports';
import { portsAt } from './portIndex';
import { nodeOf } from './state';
import {
  BREAKDOWN_CHANCE, CATCHUP_MAX, FLEET_LEGS, FLEET_LEG_HOPS, FLEET_RANGE, FLEET_REST, FLEET_WORK, REPAIR_TURNS,
} from './tuning';
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
const SALT = { rest: 11, legs: 12, target: 13, work: 14, breakdown: 15, repair: 16, reset: 17 } as const;

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

/** Where the fleet can go next: stops of its work within FLEET_LEG_HOPS of here and FLEET_RANGE of home, nearest first. */
function targets(sim: Sim, f: Fleet): string[] {
  const here = reachFrom(sim, f.node);
  const base = reachFrom(sim, portNode(f.home));
  const out: string[] = [];
  for (const id of here.order) {
    const d = here.dist.get(id) as number;
    if (d > FLEET_LEG_HOPS) break;
    if (d > 0 && (base.dist.get(id) ?? Infinity) <= FLEET_RANGE[f.role] && suits(sim, f, id)) out.push(id);
  }
  return out;
}

/** Choose the next stop (miners take one of the three nearest fields), or null when there is none. */
function pickTarget(sim: Sim, f: Fleet, turn: number): string | null {
  const list = targets(sim, f);
  const pool = f.role === 'miner' ? list.slice(0, 3) : list;
  return pool.length ? (pool[Math.floor(rnd(sim, f, turn, SALT.target) * pool.length)] as string) : null;
}

/** Plan the next leg: another stop of the outing, the way home, or (at home) a new outing; or rest when there is nowhere to go. */
function plan(sim: Sim, f: Fleet, turn: number): void {
  const home = portNode(f.home);
  let dest: string | null = null;
  if (f.legs > 0) {
    f.legs--;
    dest = pickTarget(sim, f, turn);
  } else if (f.node !== home) {
    dest = home;
  } else {
    f.legs = intIn(FLEET_LEGS[f.role], rnd(sim, f, turn, SALT.legs));
    dest = pickTarget(sim, f, turn);
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
  const port = portsAt(sim, f.node)[0];
  if (port) onDock(sim, f, port);
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
  if (f.synced >= to) return;
  if (to - f.synced > CATCHUP_MAX) {
    const home = portNode(f.home);
    Object.assign(f, { node: home, from: home, route: [], dest: home, legs: 0, dwell: intIn(FLEET_REST, rnd(sim, f, to, SALT.reset)), synced: to - CATCHUP_MAX });
    delete f.damaged;
  }
  for (let t = f.synced + 1; t <= to; t++) stepAgenda(sim, f, t);
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
