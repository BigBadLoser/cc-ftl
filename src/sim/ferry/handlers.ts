import type { Command } from '../commands';
import type { Sim } from '../sim';
import { FerryC } from './components';
import { startFerry } from './start';
import { VehicleC } from '../vehicles/components';
type FerryCommandType = Extract<Command['type'], `ferry.${string}`>;
type Handler<T extends FerryCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const ferryHandlers: { [T in FerryCommandType]: Handler<T> } = {
  'ferry.order': (sim, cmd) => {
    const err = startFerry(sim, cmd);
    if (err) reject(sim, cmd.type, err);
  },
  'ferry.cancel': (sim, cmd) => {
    const f = sim.world.get(cmd.vehicle, FerryC);
    if (!f) return reject(sim, cmd.type, 'noRun');
    f.phase = 'home';
    f.reason = 'cancelled';
    f.timer = 0;
    f.crew = [];
    const v = sim.world.get(cmd.vehicle, VehicleC);
    if (v) v.outbound = false;
  },
};
