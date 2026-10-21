import { shipIdOf, shipGrid } from '../regions';

import type { Command } from '../commands';
import { isTileWalkable } from '../modules/walk';
import { needsFrom } from '../items/materials';
import { destroyJob, structCostKey } from '../items/stacks';
import { FighterC } from '../fight/components';
import { SuitC } from '../eva/components';
import { DoorJam, Struct } from '../structure';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import {
  CrewC, DraftedC, JobC, PositionC, PrioritiesC, WORK_CATEGORIES, type Crew,
} from './components';
import { releaseBedClaim } from './beds';
import { clearPath, findJobAt, isIncapacitated, releaseAssignment } from './helpers';

export type CrewCommandType = Exclude<
  Extract<Command['type'], `job.${string}` | `crew.${string}`>,
  'job.buildModule' | 'job.deconstructModule' | 'crew.attack' | 'crew.setEngage' | 'crew.equip' | 'crew.unequip' | 'crew.hack'
>;
type Handler<T extends CrewCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

const BUILDABLE: readonly number[] = [Struct.Floor, Struct.Wall, Struct.Door];
/** Work needed (ticks at workSpeed 1): walls take 3 s, floors and doors 2 s. */
const BUILD_TICKS: Record<number, number> = { [Struct.Wall]: 3 * TICK_HZ, [Struct.Floor]: 2 * TICK_HZ, [Struct.Door]: 2 * TICK_HZ };
const DECONSTRUCT_TICKS = 2 * TICK_HZ;
/** Forcing a jammed door: 6 s at workSpeed 1 (skill and suits scale it through the worker's speed). */
const FORCE_DOOR_TICKS = 6 * TICK_HZ;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

function createJob(sim: Sim, kind: 'build' | 'deconstruct' | 'forceDoor', shipId: number, x: number, y: number, struct: number, work: number): void {
  const id = sim.world.createEntity();
  const key = kind === 'build' ? structCostKey(struct) : undefined;
  const needs = needsFrom(key ? sim.content.structCosts[key] : undefined);
  sim.world.add(id, JobC, {
    category: 'construction', kind, x, y, struct, work, progress: 0, reservedBy: 0,
    ...(needs ? { needs, delivered: [] } : {}),
  });
}

/** Shared validation: tile exists on a ship grid and has no job yet. Returns the current struct or -1. */
function checkTile(sim: Sim, type: string, shipId: number, x: number, y: number): number {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct')) return reject(sim, type, 'badGrid'), -1;
  if (!grid.inBounds(x, y)) return reject(sim, type, 'outOfBounds'), -1;
  if (findJobAt(sim, shipId, x, y)) return reject(sim, type, 'jobExists'), -1;
  return grid.get('struct', x, y);
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
    if (current === cmd.struct) return reject(sim, cmd.type, 'sameStruct');
    if (shipGrid(sim, cmd.ship)?.get('module', cmd.x, cmd.y)) return reject(sim, cmd.type, 'moduleHere');
    createJob(sim, 'build', cmd.ship, cmd.x, cmd.y, cmd.struct, BUILD_TICKS[cmd.struct] as number);
  },
  'job.deconstruct': (sim, cmd) => {
    const current = checkTile(sim, cmd.type, cmd.ship, cmd.x, cmd.y);
    if (current < 0) return;
    if (current !== Struct.Wall && current !== Struct.Door) return reject(sim, cmd.type, 'nothingToDeconstruct');
    createJob(sim, 'deconstruct', cmd.ship, cmd.x, cmd.y, Struct.Floor, DECONSTRUCT_TICKS);
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
      releaseAssignment(sim, cmd.id);
      releaseBedClaim(sim, cmd.id);
      sim.world.add(cmd.id, DraftedC, { target: null });
      crew.activity = 'drafted'; // also wakes a sleeper
    } else if (sim.world.remove(cmd.id, DraftedC)) {
      clearPath(sim, cmd.id);
      crew.activity = 'idle';
    }
  },
  'crew.moveTo': (sim, cmd) => {
    const drafted = sim.world.get(cmd.id, DraftedC);
    const pos = sim.world.get(cmd.id, PositionC);
    if (!drafted || !pos) return reject(sim, cmd.type, 'notDrafted');
    const shipId = cmd.ship !== undefined ? cmd.ship : shipIdOf(sim, pos);
    const grid = shipGrid(sim, shipId);
    if (!grid?.has('struct') || !grid.inBounds(cmd.x, cmd.y)) return reject(sim, cmd.type, 'outOfBounds');
    if (!isTileWalkable(sim, grid, cmd.x, cmd.y, sim.world.has(cmd.id, SuitC))) return reject(sim, cmd.type, 'notWalkable');
    const fighter = sim.world.get(cmd.id, FighterC);
    if (fighter) fighter.ordered = 0; // a move order cancels an attack order
    releaseAssignment(sim, cmd.id); // and a suit errand
    drafted.target = { x: cmd.x, y: cmd.y };
  },
};
