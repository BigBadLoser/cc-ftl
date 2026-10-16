import { MarkerC } from './components';
import type { Command } from './commands';
import { Struct } from './structure';
import type { Sim } from './sim';

type Handler<T extends Command['type']> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

/** One handler per command type. The compiler requires an entry for every Command variant. */
export const commandHandlers: { [T in Command['type']]: Handler<T> } = {
  noop: () => {},
  'debug.spawnMarker': (sim, cmd) => {
    const entity = sim.world.createEntity();
    sim.world.add(entity, MarkerC, { x: cmd.x, y: cmd.y });
    sim.events.emit({ type: 'debug.markerSpawned', entity, x: cmd.x, y: cmd.y });
  },
  'debug.setStruct': (sim, cmd) => {
    const grid = sim.grids.get(cmd.gridId);
    if (!grid?.has('struct') || !grid.inBounds(cmd.x, cmd.y)) return;
    if (!Object.values(Struct).includes(cmd.kind as never)) return;
    if (grid.get('struct', cmd.x, cmd.y) !== cmd.kind) grid.set('struct', cmd.x, cmd.y, cmd.kind);
  },
};
