import type { Command } from '../commands';
import { shipById } from '../combat/ships';
import { destroyJob } from '../items/stacks';
import type { Sim } from '../sim';
import { SalvageOrderC, SCRAP_TYPES } from './components';
import { partsOf, robotOnly, salvageJobs } from './plan';

type SalvageCommandType = Extract<Command['type'], `salvage.${string}`>;
type Handler<T extends SalvageCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const salvageHandlers: { [T in SalvageCommandType]: Handler<T> } = {
  'salvage.order': (sim, cmd) => {
    const ship = shipById(sim, cmd.ship);
    if (!ship) return reject(sim, cmd.type, 'noShip');
    if (ship.state !== 'wreck') return reject(sim, cmd.type, 'notDerelict');
    if (!Array.isArray(cmd.types) || cmd.types.length === 0 || !cmd.types.every((t) => SCRAP_TYPES.includes(t))) return reject(sim, cmd.type, 'badValue');
    const types = SCRAP_TYPES.filter((t) => cmd.types.includes(t));
    if (robotOnly(sim, cmd.ship)) return reject(sim, cmd.type, 'robotOnly');
    const parts = partsOf(sim, cmd.ship, types);
    if (parts.modules.length + parts.walls.length + parts.floors.length === 0) return reject(sim, cmd.type, 'nothingToStrip');
    const old = sim.world.get(cmd.ship, SalvageOrderC);
    if (old) {
      // A changed order: drop the jobs of types no longer ticked (the planner posts the new ones).
      for (const job of salvageJobs(sim, cmd.ship)) destroyJob(sim, job);
      old.types = types;
    } else {
      sim.world.add(cmd.ship, SalvageOrderC, { types, status: 'running', since: sim.tick });
    }
    sim.events.emit({ type: 'salvage.ordered', ship: cmd.ship, types: [...types] });
  },
  'salvage.cancel': (sim, cmd) => {
    if (!sim.world.remove(cmd.ship, SalvageOrderC)) return reject(sim, cmd.type, 'noOrder');
    for (const job of salvageJobs(sim, cmd.ship)) destroyJob(sim, job);
  },
};
