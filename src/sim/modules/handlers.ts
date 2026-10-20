import type { Command } from '../commands';
import { JobC } from '../crew/components';
import { findJobAt } from '../crew/helpers';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { ModuleC } from './components';
import { placementError, spawnModule } from './spawn';
import { needsFrom } from '../items/materials';

type ModuleCommandType = 'job.buildModule' | 'job.deconstructModule' | 'module.setPriority' | 'module.setEnabled' | 'debug.spawnModule';
type Handler<T extends ModuleCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

const DECON_FRACTION = 0.5;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const moduleHandlers: { [T in ModuleCommandType]: Handler<T> } = {
  'job.buildModule': (sim, cmd) => {
    const err = placementError(sim, cmd.gridId, cmd.def, cmd.x, cmd.y, cmd.rot);
    if (err) return reject(sim, cmd.type, err);
    if (findJobAt(sim, cmd.gridId, cmd.x, cmd.y)) return reject(sim, cmd.type, 'jobExists');
    const def = sim.content.modules[cmd.def];
    const needs = needsFrom(def?.cost);
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, {
      category: 'construction', kind: 'module', x: cmd.x, y: cmd.y, struct: 0,
      work: def?.buildWork ?? TICK_HZ, progress: 0, reservedBy: 0, module: { def: cmd.def, rot: cmd.rot },
      ...(needs ? { needs, delivered: [] } : {}),
    });
  },
  'job.deconstructModule': (sim, cmd) => {
    const grid = sim.grids.get(cmd.gridId);
    if (!grid?.has('module')) return reject(sim, cmd.type, 'badGrid');
    if (!grid.inBounds(cmd.x, cmd.y)) return reject(sim, cmd.type, 'outOfBounds');
    const target = grid.get('module', cmd.x, cmd.y);
    const m = sim.world.get(target, ModuleC);
    if (!m) return reject(sim, cmd.type, 'noModule');
    if (sim.world.query(JobC).some((j) => sim.world.get(j, JobC)?.target === target && sim.world.get(j, JobC)?.kind === 'moduleDecon')) {
      return reject(sim, cmd.type, 'jobExists');
    }
    const work = Math.round((sim.content.modules[m.def]?.buildWork ?? TICK_HZ) * DECON_FRACTION);
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, {
      category: 'construction', kind: 'moduleDecon', x: m.x, y: m.y, struct: 0,
      work, progress: 0, reservedBy: 0, target,
    });
  },
  'module.setPriority': (sim, cmd) => {
    const m = sim.world.get(cmd.id, ModuleC);
    if (!m) return reject(sim, cmd.type, 'noModule');
    if (!Number.isInteger(cmd.priority) || cmd.priority < 1 || cmd.priority > 5) return reject(sim, cmd.type, 'badValue');
    m.priority = cmd.priority;
  },
  'debug.spawnModule': (sim, cmd) => {
    const err = placementError(sim, cmd.gridId, cmd.def, cmd.x, cmd.y, cmd.rot);
    if (err) return reject(sim, cmd.type, err);
    spawnModule(sim, cmd.gridId, cmd.def, cmd.x, cmd.y, cmd.rot);
  },
  'module.setEnabled': (sim, cmd) => {
    const m = sim.world.get(cmd.id, ModuleC);
    if (!m) return reject(sim, cmd.type, 'noModule');
    m.enabled = cmd.enabled;
  },
};
