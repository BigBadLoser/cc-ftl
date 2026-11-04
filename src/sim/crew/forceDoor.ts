import { abortTask, attachJob } from '../ai/task';
import type { Command } from '../commands';
import { FighterC } from '../fight/components';
import { planWalk } from '../eva/route';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { EmbarkOrderC } from '../vehicles/components';
import { AssignmentC, CrewC, DeadC, DraftedC, PathC, PositionC, type Job, type Path } from './components';
import { FORCE_DOOR_TICKS, createJob } from './handlers';
import { findJobAt, isIncapacitated, isJammedDoor, jobGoal, origin } from './helpers';

/**
 * Forcing a jammed door as a drafted order (`crew.forceDoor`). It is the same 'forceDoor' job the inspector posts for undrafted crew
 * (same work, same skill, same completion in jobWork), but held by the ordered crew member from the start: they stand by (no move
 * target, so they stay drafted), walk beside the door and work it. `holder` marks the job as an order (see `keepForceDoor`).
 */

type Handlers = { 'crew.forceDoor': (sim: Sim, cmd: Extract<Command, { type: 'crew.forceDoor' }>) => void };

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const forceDoorHandlers: Handlers = {
  'crew.forceDoor': (sim, cmd) => {
    if (!isJammedDoor(sim, cmd.ship, cmd.x, cmd.y)) return reject(sim, cmd.type, 'notJammed');
    if (findJobAt(sim, cmd.ship, cmd.x, cmd.y)) return reject(sim, cmd.type, 'jobExists');
    // the nearest drafted crew member by path does it (like manning a console); the rest stay as they are
    let best: { crew: number; steps: { x: number; y: number }[] } | null = null;
    for (const id of cmd.ids) {
      const pos = sim.world.get(id, PositionC);
      if (!pos || !sim.world.has(id, CrewC) || !sim.world.has(id, DraftedC) || sim.world.has(id, DeadC) || isIncapacitated(sim, id)) continue;
      const steps = planWalk(sim, id, cmd.ship, origin(pos), jobGoal({ kind: 'forceDoor', x: cmd.x, y: cmd.y }))?.steps;
      if (steps && (!best || steps.length < best.steps.length)) best = { crew: id, steps };
    }
    if (!best) return reject(sim, cmd.type, 'unreachable');
    const { crew, steps } = best;
    abortTask(sim, crew, 'order');
    const drafted = sim.world.get(crew, DraftedC)!;
    drafted.target = null;
    delete drafted.planned;
    const f = sim.world.get(crew, FighterC);
    if (f) f.ordered = 0;
    sim.world.remove(crew, EmbarkOrderC);
    (sim.world.get(crew, CrewC) as { activity: string }).activity = 'drafted';
    const job = createJob(sim, 'forceDoor', cmd.ship, cmd.x, cmd.y, Struct.Door, FORCE_DOOR_TICKS, false, { reservedBy: crew, holder: crew });
    attachJob(sim, crew, job);
    (sim.world.get(crew, PathC) as Path).steps = steps;
  },
};

/** Keep or drop a drafted forceDoor order (autojobs): it lasts while the door is jammed and its crew member still holds it, standing by. */
export function keepForceDoor(sim: Sim, jobId: number, job: Job): boolean {
  const by = job.holder ?? 0;
  return by !== 0 && job.reservedBy === by && sim.world.get(by, AssignmentC)?.jobId === jobId && sim.world.get(by, DraftedC)?.target === null
    && isJammedDoor(sim, shipIdOf(sim, job), job.x, job.y);
}
