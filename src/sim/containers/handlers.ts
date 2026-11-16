import type { Command } from '../commands';
import type { Sim } from '../sim';
import { detachContainer } from './detach';
import { openContainer } from './open';

type ContainerCommandType = Extract<Command['type'], `container.${string}`>;
type Handler<T extends ContainerCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

export const containerHandlers: { [T in ContainerCommandType]: Handler<T> } = {
  'container.detach': (sim, cmd) => {
    if (!detachContainer(sim, cmd.id)) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'notClampedContainer' });
  },
  'container.open': (sim, cmd) => {
    if (openContainer(sim, cmd.id) === null) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: 'notDriftingContainer' });
  },
};
