import type { Command } from '../commands';
import type { Sim } from '../sim';
import { scuttle } from './prize';

type CaptureCommandType = Extract<Command['type'], 'ship.scuttle'>;

export const captureHandlers: { [T in CaptureCommandType]: (sim: Sim, cmd: Extract<Command, { type: T }>) => void } = {
  'ship.scuttle': (sim, cmd) => {
    const err = scuttle(sim, cmd.gridId);
    if (err) sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: err });
  },
};
