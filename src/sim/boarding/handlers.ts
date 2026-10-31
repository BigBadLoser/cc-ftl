import type { Command } from '../commands';
import type { Sim } from '../sim';
import { orderLaunch } from './launch';
import { orderRecall } from './recall';
import { cancelSabotage, orderSabotageGroup } from './sabotage';

type BoardingCommand = Extract<Command['type'], 'crew.sabotage' | 'crew.cancelSabotage' | 'crew.recall' | 'boarding.launch'>;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** Player boarding orders (see sabotage.ts, recall.ts). */
export const boardingHandlers: { [T in BoardingCommand]: (sim: Sim, cmd: Extract<Command, { type: T }>) => void } = {
  'crew.sabotage': (sim, cmd) => {
    const err = orderSabotageGroup(sim, cmd.ids, cmd.module);
    if (err) reject(sim, cmd.type, err);
  },
  'crew.cancelSabotage': (sim, cmd) => {
    const err = cancelSabotage(sim, cmd.ids);
    if (err) reject(sim, cmd.type, err);
  },
  'boarding.launch': (sim, cmd) => {
    const err = orderLaunch(sim, cmd.vehicle, cmd.crew, cmd.airlock);
    if (err) reject(sim, cmd.type, err);
  },
  'crew.recall': (sim, cmd) => {
    const err = orderRecall(sim, cmd.ids);
    if (err) reject(sim, cmd.type, err);
  },
};
