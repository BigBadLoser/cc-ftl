import { factionsHostile } from '../combat/factions';
import { shipOf } from '../combat/ships';
import { skillOf } from '../combat/operators';
import type { Command } from '../commands';
import { AssignmentC, CrewC, DraftedC, JobC, PathC, PositionC, type Path } from '../crew/components';
import { isIncapacitated, origin, releaseAssignment } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import { createCrew } from '../crew/spawn';
import { AllegianceC, FighterC } from '../fight/components';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import { isTileWalkable } from '../modules/walk';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { HACK_SEC } from '../tuning';
import { HackedC } from './components';

type RobotCommand = 'crew.hack' | 'debug.spawnCrew';
type Handler<T extends RobotCommand> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const robotHandlers: { [T in RobotCommand]: Handler<T> } = {
  'crew.hack': (sim, cmd) => {
    const pos = sim.world.get(cmd.id, PositionC);
    if (!sim.world.has(cmd.id, CrewC) || !pos) return reject(sim, cmd.type, 'noCrew');
    if (isIncapacitated(sim, cmd.id)) return reject(sim, cmd.type, 'incapacitated');
    if (skillOf(sim, cmd.id, 'hacking') <= 0) return reject(sim, cmd.type, 'noSkill');
    const m = sim.world.get(cmd.module, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def?.aiCore || m.hp <= 0) return reject(sim, cmd.type, 'badTarget');
    if (sim.world.has(cmd.module, HackedC)) return reject(sim, cmd.type, 'alreadyHacked');
    if (!factionsHostile(sim.world.get(cmd.id, AllegianceC)?.faction, shipOf(sim, m.gridId)?.faction)) return reject(sim, cmd.type, 'notHostile');
    if (pos.gridId !== m.gridId) return reject(sim, cmd.type, 'notAboard');
    let plan: { x: number; y: number; steps: { x: number; y: number }[] } | null = null;
    for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
      const steps = findPath(sim, pos.gridId, origin(pos), { x: t.x, y: t.y, adjacent: true });
      if (steps && (!plan || steps.length < plan.steps.length)) plan = { x: t.x, y: t.y, steps };
    }
    if (!plan) return reject(sim, cmd.type, 'unreachable');
    // A hack is a drafted order: the hacker stands by (no move target) and works until done or pulled away.
    releaseAssignment(sim, cmd.id);
    const drafted = sim.world.get(cmd.id, DraftedC);
    if (drafted) {
      drafted.target = null;
      delete drafted.planned;
    } else sim.world.add(cmd.id, DraftedC, { target: null });
    const f = sim.world.get(cmd.id, FighterC);
    if (f) f.ordered = 0;
    (sim.world.get(cmd.id, CrewC) as { activity: string }).activity = 'drafted';
    const job = sim.world.createEntity();
    sim.world.add(job, JobC, {
      category: 'operating', kind: 'hack', gridId: m.gridId, x: plan.x, y: plan.y, struct: 0,
      work: Math.round(HACK_SEC * TICK_HZ), progress: 0, reservedBy: cmd.id, target: cmd.module,
    });
    sim.world.add(cmd.id, AssignmentC, { jobId: job });
    (sim.world.get(cmd.id, PathC) as Path).steps = plan.steps;
  },
  'debug.spawnCrew': (sim, cmd) => {
    const grid = sim.grids.get(cmd.gridId);
    if (!grid?.has('struct') || !grid.inBounds(cmd.x, cmd.y) || !isTileWalkable(sim, grid, cmd.x, cmd.y)) return reject(sim, cmd.type, 'notWalkable');
    const faction = cmd.faction ?? shipOf(sim, cmd.gridId)?.faction ?? 'player';
    if (!createCrew(sim, cmd.gridId, cmd.role, { x: cmd.x, y: cmd.y }, { faction, rest: 100 })) return reject(sim, cmd.type, 'badRole');
  },
};
