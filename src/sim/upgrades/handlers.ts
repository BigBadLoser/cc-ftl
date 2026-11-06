import type { Command } from '../commands';
import { JobC } from '../crew/components';
import { needsFrom } from '../items/materials';
import { destroyJob } from '../items/stacks';
import { shipStoreCount } from '../items/stock';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { fitError, fitJobOf } from './fit';

type UpgradeCommand = 'module.fitUpgrade' | 'module.removeUpgrade' | 'module.cancelUpgrade' | 'debug.setUpgrade';

/** Seconds of engineer work to swap an upgrade. */
export const FIT_SEC = 8;

const reject = (sim: Sim, command: string, reason: string): void => void sim.events.emit({ type: 'command.rejected', command, reason });

function post(sim: Sim, moduleId: number, item: string | null): void {
  const m = sim.world.get(moduleId, ModuleC);
  if (!m) return;
  const id = sim.world.createEntity();
  sim.world.add(id, JobC, {
    category: 'repair', kind: 'fit', x: m.x, y: m.y, struct: 0, work: FIT_SEC * TICK_HZ, progress: 0, reservedBy: 0, target: moduleId, fit: { item },
    ...(item ? { needs: needsFrom([{ item, count: 1 }]), delivered: [] } : {}),
  });
}

/** Commands to fit, remove or call off an upgrade; the work itself is a crew job (upgrades/fit.ts, crew/jobWork.ts). */
export const upgradeHandlers: { [T in UpgradeCommand]: (sim: Sim, cmd: Extract<Command, { type: T }>) => void } = {
  'module.fitUpgrade': (sim, cmd) => {
    const m = sim.world.get(cmd.moduleId, ModuleC);
    const err = fitError(sim, cmd.moduleId, cmd.item);
    if (err) return reject(sim, cmd.type, err);
    if (m?.upgrade === cmd.item) return reject(sim, cmd.type, 'alreadyFitted');
    if (fitJobOf(sim, cmd.moduleId)) return reject(sim, cmd.type, 'jobExists');
    if (shipStoreCount(sim, shipIdOf(sim, m), cmd.item) < 1) return reject(sim, cmd.type, 'notInCargo');
    post(sim, cmd.moduleId, cmd.item);
  },
  'module.removeUpgrade': (sim, cmd) => {
    const m = sim.world.get(cmd.moduleId, ModuleC);
    if (!m) return reject(sim, cmd.type, 'noModule');
    if (!m.upgrade) return reject(sim, cmd.type, 'noUpgrade');
    if (fitJobOf(sim, cmd.moduleId)) return reject(sim, cmd.type, 'jobExists');
    post(sim, cmd.moduleId, null);
  },
  'debug.setUpgrade': (sim, cmd) => {
    const m = sim.world.get(cmd.moduleId, ModuleC);
    if (!m) return reject(sim, cmd.type, 'noModule');
    const err = cmd.item ? fitError(sim, cmd.moduleId, cmd.item) : null;
    if (err) return reject(sim, cmd.type, err);
    if (cmd.item) m.upgrade = cmd.item;
    else delete m.upgrade;
  },
  'module.cancelUpgrade': (sim, cmd) => {
    const j = fitJobOf(sim, cmd.moduleId);
    if (!j) return reject(sim, cmd.type, 'noJob');
    destroyJob(sim, j[0]);
  },
};
