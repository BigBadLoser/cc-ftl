import { shipIdOf, shipGrid } from '../regions';
import { abortTask } from '../ai/task';

import type { Command } from '../commands';
import { isTileWalkable } from '../modules/walk';
import { needsFrom } from '../items/materials';
import { destroyJob, structCostKey } from '../items/stacks';
import { FighterC } from '../fight/components';
import { SuitC } from '../eva/components';
import { DoorJam, Struct } from '../structure';
import type { Sim } from '../sim';
import type { GridLike } from '../grid';
import { rockBuild } from '../rock/dig';
import { wake } from '../combat/dormant';
import { ShipC } from '../combat/components';
import { TICK_HZ } from '../time';
import {
  CrewC, DeadC, DraftedC, JobC, PositionC, PrioritiesC, WORK_CATEGORIES, type Crew, type Job, type Position,
} from './components';
import { clearPath, findJobAt, isIncapacitated, origin } from './helpers';
import { EmbarkOrderC } from '../vehicles/components';
import { assignTiles, spreadTiles, tileKey, type Tile } from './spread';

export type CrewCommandType = Exclude<
  Extract<Command['type'], `job.${string}` | `crew.${string}`>,
  'job.buildModule' | 'job.deconstructModule' | 'crew.attack' | 'crew.man' | 'crew.setEngage' | 'crew.equip' | 'crew.unequip' | 'crew.hack' | 'crew.hire' | 'crew.sabotage' | 'crew.cancelSabotage' | 'crew.recall'
>;
type Handler<T extends CrewCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

const BUILDABLE: readonly number[] = [Struct.Floor, Struct.Wall, Struct.Door, Struct.Ground, Struct.RockWall];
/** Work needed (ticks at workSpeed 1): walls take 3 s, floors and doors 2 s, a truss (the shipyard's, `yard/`) 1 s. */
export const BUILD_TICKS: Record<number, number> = { [Struct.Wall]: 3 * TICK_HZ, [Struct.Floor]: 2 * TICK_HZ, [Struct.Door]: 2 * TICK_HZ, [Struct.Beam]: TICK_HZ };
const DECONSTRUCT_TICKS = 2 * TICK_HZ;
/** Forcing a jammed door: 6 s at workSpeed 1 (skill and suits scale it through the worker's speed). */
const FORCE_DOOR_TICKS = 6 * TICK_HZ;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** Post a construction job on a tile. `free`: no materials to deliver (digging, or paid for up front, as the shipyard's are); `extra` is merged into the job. Returns the job entity. */
export function createJob(sim: Sim, kind: 'build' | 'deconstruct' | 'forceDoor', shipId: number, x: number, y: number, struct: number, work: number, free = false, extra: Partial<Job> = {}): number {
  const id = sim.world.createEntity();
  const key = kind === 'build' && !free ? structCostKey(struct) : undefined;
  const needs = needsFrom(key ? sim.content.structCosts[key] : undefined);
  sim.world.add(id, JobC, {
    category: 'construction', kind, x, y, struct, work, progress: 0, reservedBy: 0,
    ...(needs ? { needs, delivered: [] } : {}),
    ...extra,
  });
  return id;
}

/** Shared validation: tile exists on a ship grid and has no job yet. Returns the current struct or -1. */
function checkTile(sim: Sim, type: string, shipId: number, x: number, y: number): number {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct')) return reject(sim, type, 'badGrid'), -1;
  if (!grid.inBounds(x, y)) return reject(sim, type, 'outOfBounds'), -1;
  if (findJobAt(sim, shipId, x, y)) return reject(sim, type, 'jobExists'), -1;
  return grid.get('struct', x, y);
}

/** Build orders come from the player: one aimed at a dormant outpost (digging or building into it) provokes it. */
function provokeIfOutpost(sim: Sim, ship: number): void {
  const s = sim.world.get(ship, ShipC);
  if (s?.outpost) wake(sim, ship, 'dug');
}

function crewOf(sim: Sim, type: string, id: number): Crew | undefined {
  const crew = sim.world.get(id, CrewC);
  if (!crew) reject(sim, type, 'noCrew');
  return crew;
}

export const crewHandlers: { [T in CrewCommandType]: Handler<T> } = {
  'job.build': (sim, cmd) => {
    if (!BUILDABLE.includes(cmd.struct)) return reject(sim, cmd.type, 'badStruct');
    const current = checkTile(sim, cmd.type, cmd.ship, cmd.x, cmd.y);
    if (current < 0) return;
    provokeIfOutpost(sim, cmd.ship);
    if (current === cmd.struct) return reject(sim, cmd.type, 'sameStruct');
    if (shipGrid(sim, cmd.ship)?.get('module', cmd.x, cmd.y)) return reject(sim, cmd.type, 'moduleHere');
    if (current === Struct.Rock || (current === Struct.RockWall && cmd.struct !== Struct.Door)) {
      // digging (Floor), levelling (Ground) or finishing (RockWall) rock: slow, free
      const r = rockBuild(shipGrid(sim, cmd.ship) as GridLike, cmd.x, cmd.y, cmd.struct);
      if ('error' in r) return reject(sim, cmd.type, r.error);
      createJob(sim, 'build', cmd.ship, cmd.x, cmd.y, cmd.struct, r.work, true);
      return;
    }
    if (cmd.struct === Struct.Ground || cmd.struct === Struct.RockWall) return reject(sim, cmd.type, 'notRock');
    createJob(sim, 'build', cmd.ship, cmd.x, cmd.y, cmd.struct, BUILD_TICKS[cmd.struct] as number);
  },
  'job.deconstruct': (sim, cmd) => {
    const current = checkTile(sim, cmd.type, cmd.ship, cmd.x, cmd.y);
    if (current < 0) return;
    provokeIfOutpost(sim, cmd.ship);
    if (current !== Struct.Wall && current !== Struct.Door && current !== Struct.Beam) return reject(sim, cmd.type, 'nothingToDeconstruct');
    createJob(sim, 'deconstruct', cmd.ship, cmd.x, cmd.y, current === Struct.Beam ? Struct.Space : Struct.Floor, DECONSTRUCT_TICKS);
  },
  'job.forceDoor': (sim, cmd) => {
    const current = checkTile(sim, cmd.type, cmd.ship, cmd.x, cmd.y);
    if (current < 0) return;
    if (current !== Struct.Door || (shipGrid(sim, cmd.ship)?.get('jam', cmd.x, cmd.y) ?? 0) === DoorJam.None) return reject(sim, cmd.type, 'notJammed');
    createJob(sim, 'forceDoor', cmd.ship, cmd.x, cmd.y, Struct.Door, FORCE_DOOR_TICKS);
  },
  'job.cancel': (sim, cmd) => {
    const jobId = findJobAt(sim, cmd.ship, cmd.x, cmd.y);
    if (!jobId) return reject(sim, cmd.type, 'noJob');
    destroyJob(sim, jobId); // delivered materials fall to the floor; hauls aimed at it are dropped by haulCleanup
  },
  'crew.setPriority': (sim, cmd) => {
    const prio = sim.world.get(cmd.id, PrioritiesC);
    if (!prio) return reject(sim, cmd.type, 'noCrew');
    if (!WORK_CATEGORIES.includes(cmd.category)) return reject(sim, cmd.type, 'badCategory');
    if (!Number.isInteger(cmd.value) || cmd.value < 0 || cmd.value > 4) return reject(sim, cmd.type, 'badValue');
    prio[cmd.category] = cmd.value;
  },
  'crew.resetPriorities': (sim, cmd) => {
    const crew = crewOf(sim, cmd.type, cmd.id);
    if (!crew) return;
    const role = sim.content.roles[crew.role];
    if (!role) return reject(sim, cmd.type, 'badRole');
    sim.world.add(cmd.id, PrioritiesC, { ...role.priorities });
  },
  'crew.draft': (sim, cmd) => {
    const crew = crewOf(sim, cmd.type, cmd.id);
    if (!crew) return;
    if (cmd.drafted) {
      if (sim.world.has(cmd.id, DraftedC)) return;
      if (isIncapacitated(sim, cmd.id)) return reject(sim, cmd.type, 'incapacitated');
      abortTask(sim, cmd.id, 'drafted');
      sim.world.add(cmd.id, DraftedC, { target: null });
      crew.activity = 'drafted'; // also wakes a sleeper
    } else if (sim.world.remove(cmd.id, DraftedC)) {
      clearPath(sim, cmd.id);
      crew.activity = 'idle';
    }
  },
  'crew.moveTo': (sim, cmd) => {
    const pos = sim.world.get(cmd.id, PositionC);
    if (!sim.world.has(cmd.id, DraftedC) || !pos) return reject(sim, cmd.type, 'notDrafted');
    const err = orderMove(sim, cmd.id, cmd.ship !== undefined ? cmd.ship : shipIdOf(sim, pos), cmd.x, cmd.y);
    if (err) reject(sim, cmd.type, err);
  },
  'crew.moveGroup': (sim, cmd) => {
    const walkers = cmd.ids.filter((id) => sim.world.has(id, DraftedC) && sim.world.has(id, PositionC));
    if (!walkers.length) return reject(sim, cmd.type, 'notDrafted');
    const shipId = cmd.ship !== undefined ? cmd.ship : shipIdOf(sim, sim.world.get(walkers[0] as number, PositionC));
    const grid = shipGrid(sim, shipId);
    if (!grid?.has('struct') || !grid.inBounds(cmd.x, cmd.y)) return reject(sim, cmd.type, 'outOfBounds');
    const here = walkers.filter((id) => shipIdOf(sim, sim.world.get(id, PositionC)) === shipId);
    if (!here.length) return reject(sim, cmd.type, 'otherShip');
    // Free tiles around the click: not where someone outside the group stands.
    const taken = new Set<number>();
    for (const o of sim.world.query(CrewC, PositionC)) {
      const p = sim.world.get(o, PositionC) as Position;
      if (!walkers.includes(o) && !sim.world.has(o, DeadC) && shipIdOf(sim, p) === shipId) taken.add(tileKey(Math.round(p.x), Math.round(p.y)));
    }
    const tiles = spreadTiles(sim, grid, { x: cmd.x, y: cmd.y }, here.length, taken);
    const spots = assignTiles(here.map((id) => ({ id, ...origin(sim.world.get(id, PositionC) as Position) })), tiles.length ? tiles : [{ x: cmd.x, y: cmd.y }]);
    let first: string | null = null;
    let any = false;
    for (const id of here) {
      const t = spots.get(id) as Tile;
      const err = orderMove(sim, id, shipId, t.x, t.y);
      if (err) first ??= err;
      else any = true;
    }
    if (!any && first) reject(sim, cmd.type, first);
  },
};

/** A drafted crew member's walk order to a tile of its own ship. Returns a reject reason, or null. */
function orderMove(sim: Sim, id: number, shipId: number, x: number, y: number): string | null {
  const drafted = sim.world.get(id, DraftedC);
  const pos = sim.world.get(id, PositionC);
  if (!drafted || !pos) return 'notDrafted';
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct') || !grid.inBounds(x, y)) return 'outOfBounds';
  if (shipIdOf(sim, pos) !== shipId) return 'otherShip'; // the walk planner stays on one grid: the order would only lapse
  if (!isTileWalkable(sim, grid, x, y, sim.world.has(id, SuitC))) return 'notWalkable';
  const fighter = sim.world.get(id, FighterC);
  if (fighter) fighter.ordered = 0; // a move order cancels an attack order
  abortTask(sim, id, 'order'); // and a suit errand
  sim.world.remove(id, EmbarkOrderC); // and a walk to a shuttle
  drafted.target = { x, y };
  delete drafted.planned;
  return null;
}
