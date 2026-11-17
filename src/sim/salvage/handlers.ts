import type { Command } from '../commands';
import { shipById } from '../combat/ships';
import { destroyJob } from '../items/stacks';
import type { ScrapType } from '../registry';
import type { Sim } from '../sim';
import { SalvageOrderC, SCRAP_TYPES } from './components';
import { partCount, partsOf, robotOnly, salvageJobs } from './plan';

type SalvageCommandType = Extract<Command['type'], `salvage.${string}`>;
type Handler<T extends SalvageCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/**
 * Put a salvage order for `types` on a wreck (or change its order): the one owner of whether an order may stand. Returns the rejection reason, or null when
 * it was placed. The command and `container.open` (which marks a lost container for cutting open) both go through it.
 */
export function placeSalvageOrder(sim: Sim, shipId: number, requested: readonly ScrapType[]): string | null {
  const ship = shipById(sim, shipId);
  if (!ship) return 'noShip';
  if (ship.state !== 'wreck') return 'notDerelict';
  if (!Array.isArray(requested) || requested.length === 0 || !requested.every((t) => SCRAP_TYPES.includes(t))) return 'badValue';
  const types = SCRAP_TYPES.filter((t) => requested.includes(t));
  if (robotOnly(sim, shipId)) return 'robotOnly';
  if (partCount(partsOf(sim, shipId, types)) === 0) return 'nothingToStrip';
  const old = sim.world.get(shipId, SalvageOrderC);
  if (old) {
    // A changed order: drop the jobs of types no longer ticked (the planner posts the new ones).
    for (const job of salvageJobs(sim, shipId)) destroyJob(sim, job);
    old.types = types;
  } else {
    sim.world.add(shipId, SalvageOrderC, { types, status: 'running', done: 0, since: sim.tick });
  }
  sim.events.emit({ type: 'salvage.ordered', ship: shipId, types: [...types] });
  return null;
}

export const salvageHandlers: { [T in SalvageCommandType]: Handler<T> } = {
  'salvage.order': (sim, cmd) => {
    const why = placeSalvageOrder(sim, cmd.ship, cmd.types);
    if (why) reject(sim, cmd.type, why);
  },
  'salvage.cancel': (sim, cmd) => {
    if (!sim.world.remove(cmd.ship, SalvageOrderC)) return reject(sim, cmd.type, 'noOrder');
    for (const job of salvageJobs(sim, cmd.ship)) destroyJob(sim, job);
  },
};
