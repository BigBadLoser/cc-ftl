import type { Command } from './commands';
import { AirlockC } from './modules/airlock';
import { shipGrid } from './regions';
import type { Sim } from './sim';
import { Struct, VentState } from './structure';

type Handlers = { 'door.vent': (sim: Sim, cmd: Extract<Command, { type: 'door.vent' }>) => void };

/** `door.vent`: the player's vent setting on a door tile. An airlock's door is its own system's and has no vent. */
export const ventHandlers: Handlers = {
  'door.vent': (sim, cmd) => {
    const grid = shipGrid(sim, cmd.ship);
    const reject = (reason: string): void => sim.events.emit({ type: 'command.rejected', command: cmd.type, reason });
    if (!grid || !grid.has('vent') || !grid.inBounds(cmd.x, cmd.y) || grid.get('struct', cmd.x, cmd.y) !== Struct.Door) return reject('notDoor');
    const mod = grid.has('module') ? grid.get('module', cmd.x, cmd.y) : 0;
    if (mod !== 0 && sim.world.has(mod, AirlockC)) return reject('airlockDoor');
    // Open starts as Open; the next vents pass holds it shut if it must be. Closing clears any hold.
    const next = cmd.open ? Math.max(grid.get('vent', cmd.x, cmd.y), VentState.Open) : VentState.Closed;
    if (grid.get('vent', cmd.x, cmd.y) !== next) grid.set('vent', cmd.x, cmd.y, next);
  },
};
