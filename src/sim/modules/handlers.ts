import type { Command } from '../commands';

import { JobC } from '../crew/components';
import { findJobAt } from '../crew/helpers';
import type { Sim } from '../sim';
import { AUTO_LEVEL_TICKS } from '../rock/dig';
import { footprintTiles, rotatedSize } from './footprint';
import { Struct } from '../structure';
import { TICK_HZ } from '../time';
import { AirlockC, requestAirlock } from './airlock';
import { ModuleC } from './components';
import { placementError, spawnModule } from './spawn';
import { isKnown } from './blueprints';
import { needsFrom } from '../items/materials';
import { shipGrid } from '../regions';

type ModuleCommandType = 'job.buildModule' | 'job.deconstructModule' | 'module.setPowerPriority' | 'module.setEnabled' | 'debug.spawnModule' | 'airlock.cycle';
type Handler<T extends ModuleCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

const DECON_FRACTION = 0.5;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const moduleHandlers: { [T in ModuleCommandType]: Handler<T> } = {
  'airlock.cycle': (sim, cmd) => {
    if (!sim.world.has(cmd.moduleId, AirlockC)) return reject(sim, cmd.type, 'noAirlock');
    if (cmd.to !== 'inner' && cmd.to !== 'outer') return reject(sim, cmd.type, 'badValue');
    requestAirlock(sim, cmd.moduleId, cmd.to);
  },
  'job.buildModule': (sim, cmd) => {
    if (!isKnown(sim, cmd.def)) return reject(sim, cmd.type, sim.content.modules[cmd.def] ? 'unknownBlueprint' : 'badDef');
    const err = placementError(sim, cmd.ship, cmd.def, cmd.x, cmd.y, cmd.rot);
    if (err) return reject(sim, cmd.type, err);
    if (findJobAt(sim, cmd.ship, cmd.x, cmd.y)) return reject(sim, cmd.type, 'jobExists');
    const def = sim.content.modules[cmd.def];
    const needs = needsFrom(def?.cost);
    const grid = shipGrid(sim, cmd.ship);
    const rock = def && grid ? footprintTiles(def, cmd.x, cmd.y, cmd.rot).filter((t) => grid.get('struct', t.x, t.y) === Struct.Rock).length : 0;
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, {
      category: 'construction', kind: 'module', x: cmd.x, y: cmd.y, struct: 0,
      work: (def?.buildWork ?? TICK_HZ) + rock * AUTO_LEVEL_TICKS, progress: 0, reservedBy: 0, module: { def: cmd.def, rot: cmd.rot },
      ...(def ? { size: rotatedSize(def, cmd.rot) } : {}),
      ...(needs ? { needs, delivered: [] } : {}),
    });
  },
  'job.deconstructModule': (sim, cmd) => {
    const grid = shipGrid(sim, cmd.ship);
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
  'module.setPowerPriority': (sim, cmd) => {
    const m = sim.world.get(cmd.id, ModuleC);
    if (!m) return reject(sim, cmd.type, 'noModule');
    if (!Number.isInteger(cmd.powerPriority) || cmd.powerPriority < 1 || cmd.powerPriority > 5) return reject(sim, cmd.type, 'badValue');
    m.powerPriority = cmd.powerPriority;
  },
  'debug.spawnModule': (sim, cmd) => {
    const err = placementError(sim, cmd.ship, cmd.def, cmd.x, cmd.y, cmd.rot);
    if (err) return reject(sim, cmd.type, err);
    spawnModule(sim, cmd.def, cmd.x, cmd.y, cmd.rot);
  },
  'module.setEnabled': (sim, cmd) => {
    const m = sim.world.get(cmd.id, ModuleC);
    if (!m) return reject(sim, cmd.type, 'noModule');
    m.enabled = cmd.enabled;
  },
};
