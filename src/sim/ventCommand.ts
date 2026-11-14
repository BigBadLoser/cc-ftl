import type { Command } from './commands';
import { shipGrid } from './regions';
import type { Sim } from './sim';
import { VentState } from './structure';
import { ventableDoor } from './vents';

type Handlers = { 'door.vent': (sim: Sim, cmd: Extract<Command, { type: 'door.vent' }>) => void };

/** `door.vent`: the player's vent setting on a door tile. Rejected unless `ventableDoor` (airlock doors have no vent). */
export const ventHandlers: Handlers = {
  'door.vent': (sim, cmd) => {
    const grid = shipGrid(sim, cmd.ship);
    const reject = (reason: string): void => sim.events.emit({ type: 'command.rejected', command: cmd.type, reason });
    if (!grid || !ventableDoor(sim, grid, cmd.x, cmd.y)) return reject('notVentable');
    // Open starts as Open; the next vents pass holds it shut if it must be. Closing clears any hold.
    const next = cmd.open ? Math.max(grid.get('vent', cmd.x, cmd.y), VentState.Open) : VentState.Closed;
    if (grid.get('vent', cmd.x, cmd.y) !== next) grid.set('vent', cmd.x, cmd.y, next);
  },
};
