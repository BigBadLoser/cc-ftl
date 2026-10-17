import type { Command } from '../commands';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { ProductionC, StorageC } from './components';
import { spillItems } from './stacks';

type ItemCommandType = 'production.add' | 'production.remove' | 'production.edit' | 'production.reorder' | 'storage.setFilter' | 'debug.spawnItems';
type Handler<T extends ItemCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const itemHandlers: { [T in ItemCommandType]: Handler<T> } = {
  'production.add': (sim, cmd) => {
    const prod = sim.world.get(cmd.moduleId, ProductionC);
    const m = sim.world.get(cmd.moduleId, ModuleC);
    if (!prod || !m) return reject(sim, cmd.type, 'noStation');
    const recipe = sim.content.recipes[cmd.recipe];
    if (!recipe) return reject(sim, cmd.type, 'badRecipe');
    if (recipe.station !== m.def) return reject(sim, cmd.type, 'wrongStation');
    if (cmd.mode !== 'count' && cmd.mode !== 'keep') return reject(sim, cmd.type, 'badMode');
    if (!Number.isInteger(cmd.target) || cmd.target < 1) return reject(sim, cmd.type, 'badValue');
    prod.orders.push({ recipe: cmd.recipe, mode: cmd.mode, target: cmd.target, done: 0 });
  },
  'production.remove': (sim, cmd) => {
    const prod = sim.world.get(cmd.moduleId, ProductionC);
    if (!prod) return reject(sim, cmd.type, 'noStation');
    if (!prod.orders[cmd.index]) return reject(sim, cmd.type, 'badIndex');
    prod.orders.splice(cmd.index, 1);
  },
  'production.edit': (sim, cmd) => {
    const order = sim.world.get(cmd.moduleId, ProductionC)?.orders[cmd.index];
    if (!order) return reject(sim, cmd.type, 'badIndex');
    if (cmd.mode !== undefined && cmd.mode !== 'count' && cmd.mode !== 'keep') return reject(sim, cmd.type, 'badMode');
    if (cmd.target !== undefined && (!Number.isInteger(cmd.target) || cmd.target < 1)) return reject(sim, cmd.type, 'badValue');
    if (cmd.mode !== undefined) order.mode = cmd.mode;
    if (cmd.target !== undefined) order.target = cmd.target;
  },
  'production.reorder': (sim, cmd) => {
    const prod = sim.world.get(cmd.moduleId, ProductionC);
    if (!prod) return reject(sim, cmd.type, 'noStation');
    const n = prod.orders.length;
    if (!Number.isInteger(cmd.from) || !Number.isInteger(cmd.to) || cmd.from < 0 || cmd.to < 0 || cmd.from >= n || cmd.to >= n) {
      return reject(sim, cmd.type, 'badIndex');
    }
    const [moved] = prod.orders.splice(cmd.from, 1);
    if (moved) prod.orders.splice(cmd.to, 0, moved);
  },
  'storage.setFilter': (sim, cmd) => {
    const s = sim.world.get(cmd.moduleId, StorageC);
    if (!s) return reject(sim, cmd.type, 'noStorage');
    if (cmd.items !== null && cmd.items.some((i) => !sim.content.items[i])) return reject(sim, cmd.type, 'badItem');
    s.filter = cmd.items === null ? null : [...cmd.items];
  },
  'debug.spawnItems': (sim, cmd) => {
    const grid = sim.grids.get(cmd.gridId);
    if (!grid?.has('item') || !grid.inBounds(cmd.x, cmd.y)) return reject(sim, cmd.type, 'outOfBounds');
    if (!sim.content.items[cmd.item]) return reject(sim, cmd.type, 'badItem');
    if (!Number.isInteger(cmd.count) || cmd.count < 1) return reject(sim, cmd.type, 'badValue');
    if (spillItems(sim, cmd.gridId, cmd.x, cmd.y, cmd.item, cmd.count) > 0) reject(sim, cmd.type, 'noRoom');
  },
};
