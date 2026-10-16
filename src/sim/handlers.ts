import { MarkerC } from './components';
import type { Command } from './commands';
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
};
