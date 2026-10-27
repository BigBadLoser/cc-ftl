import type { Command } from '../commands';
import { CrewC, DraftedC, PositionC } from '../crew/components';
import { shipIdOf } from '../regions';
import { EmbarkOrderC } from '../vehicles/components';
import { clearPath } from '../crew/helpers';
import type { Sim } from '../sim';
import { FighterC, type Fighter } from './components';
import { manStation } from './man';
import { dropWeapon, orderEquip } from './equip';
import { isCombatReady, isHostile } from './relations';
import { EggSacC } from '../aliens/components';
import { sacAlive } from '../aliens/target';

type FightCommand = 'crew.attack' | 'crew.man' | 'crew.setEngage' | 'crew.equip' | 'crew.unequip';
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
  'crew.man': (sim, cmd) => {
    const err = manStation(sim, cmd.id, cmd.module);
    if (err) reject(sim, cmd.type, err);
  },
  'crew.attack': (sim, cmd) => {
    if (!sim.world.has(cmd.id, CrewC)) return reject(sim, cmd.type, 'noCrew');
    const drafted = sim.world.get(cmd.id, DraftedC);
    if (!drafted) return reject(sim, cmd.type, 'notDrafted');
    const sac = sim.world.get(cmd.target, EggSacC);
    if (sac ? !sacAlive(sac) : !isCombatReady(sim, cmd.target) || !isHostile(sim, cmd.id, cmd.target)) return reject(sim, cmd.type, 'badTarget');
    // The fight runs per grid: a target on another ship can't be reached, and the order would only wipe the walk the crew member was on.
    const here = sim.world.get(cmd.id, PositionC);
    const tp = sim.world.get(cmd.target, PositionC);
    const there = sac ? sac.ship : tp ? shipIdOf(sim, tp) : 0;
    if (!here || shipIdOf(sim, here) !== there) return reject(sim, cmd.type, 'otherShip');
    fighter(sim, cmd.id).ordered = cmd.target;
    sim.world.remove(cmd.id, EmbarkOrderC);
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

