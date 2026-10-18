import type { Command } from '../commands';
import { CrewC, DraftedC } from '../crew/components';
import { clearPath } from '../crew/helpers';
import type { Sim } from '../sim';
import { FighterC, type Fighter } from './components';
import { dropWeapon, orderEquip } from './equip';
import { isCombatReady, isHostile } from './relations';

type FightCommand = 'crew.attack' | 'crew.setEngage' | 'crew.equip' | 'crew.unequip';
type Handler<T extends FightCommand> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

function fighter(sim: Sim, id: number): Fighter {
  let f = sim.world.get(id, FighterC);
  if (!f) {
    f = { mode: 'idle', target: 0, ordered: 0, engage: true, cooldown: 0, planned: -1000 };
    sim.world.add(id, FighterC, f);
  }
  return f;
}

export const fightHandlers: { [T in FightCommand]: Handler<T> } = {
  'crew.attack': (sim, cmd) => {
    if (!sim.world.has(cmd.id, CrewC)) return reject(sim, cmd.type, 'noCrew');
    const drafted = sim.world.get(cmd.id, DraftedC);
    if (!drafted) return reject(sim, cmd.type, 'notDrafted');
    if (!isCombatReady(sim, cmd.target) || !isHostile(sim, cmd.id, cmd.target)) return reject(sim, cmd.type, 'badTarget');
    fighter(sim, cmd.id).ordered = cmd.target;
    drafted.target = null; // attacking replaces a walk order
    delete drafted.planned;
    clearPath(sim, cmd.id);
  },
  'crew.setEngage': (sim, cmd) => {
    if (!sim.world.has(cmd.id, CrewC)) return reject(sim, cmd.type, 'noCrew');
    fighter(sim, cmd.id).engage = cmd.engage;
  },
  'crew.equip': (sim, cmd) => {
    const reason = orderEquip(sim, cmd.id, cmd.item);
    if (reason) reject(sim, cmd.type, reason);
  },
  'crew.unequip': (sim, cmd) => {
    if (!sim.world.has(cmd.id, CrewC)) return reject(sim, cmd.type, 'noCrew');
    const item = dropWeapon(sim, cmd.id);
    if (!item) return reject(sim, cmd.type, 'nothingEquipped');
    sim.events.emit({ type: 'crew.unequipped', crew: cmd.id, item });
  },
};

