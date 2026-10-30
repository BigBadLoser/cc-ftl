import type { Command } from '../commands';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';

type Handler = (sim: Sim, cmd: Extract<Command, { type: 'module.priorityRepair' }>) => void;

/**
 * Priority repair: the one manual lever of damage control. A flagged module's repair job beats every other for the crew who
 * repair (decide's job score); a later order ranks above an earlier one. The flag clears itself at full hp (autojobs).
 */
export const repairHandlers: { 'module.priorityRepair': Handler } = {
  'module.priorityRepair': (sim, cmd) => {
    const m = sim.world.get(cmd.id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def) return void sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'noModule' });
    if (!cmd.on) return void delete m.repairFirst;
    if (m.hp >= def.maxHp) return void sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'notDamaged' });
    let top = 0;
    for (const id of sim.world.query(ModuleC)) top = Math.max(top, sim.world.get(id, ModuleC)?.repairFirst ?? 0);
    m.repairFirst = top + 1;
  },
};
