import { SECTOR_HEIGHT, SECTOR_WIDTH } from '../tuning';
import type { Sim } from '../sim';
import { archiveSector, restoreArchive } from './archive';
import { liftShip } from './packet';
import type { WithDocked } from './members';

/**
 * The player's ship leaves the node it is in and enters hyperspace (sector refactor step 9): lift it (with what travels along, see
 * `liftShip`) into a packet, freeze the rest of the sector into the archive of the node left, drop the hails and offers of that
 * node, end combat if there was any (`combat.ended`), and wait in state 'hyperspace' with the sector empty. Callers (`galaxy.jump`, the player's `combat.flee`, the debug
 * teleport) validate and pay first.
 */
export function enterHyperspace(sim: Sim, ship: number, withDocked: WithDocked = false): void {
  const packet = liftShip(sim, ship, { withDocked });
  // Leaving ends any fight here (the combat system does not run in hyperspace to say so).
  if (sim.sector.inCombat) sim.events.emit({ type: 'combat.ended' });
  archiveSector(sim);
  sim.trade.hails = [];
  sim.trade.offers = [];
  sim.sector.width = SECTOR_WIDTH;
  sim.sector.height = SECTOR_HEIGHT;
  sim.sector.state = 'hyperspace';
  sim.sector.packet = packet;
}

/**
 * The ship drops out of hyperspace at `sim.sector.node`: the archive of that node comes back if it has one (else the sector is
 * empty and the galaxy fills it, see `galaxy/drop.ts`), and the ship waits in state 'deploying' for `sector.deploy`.
 * Returns whether an archive was restored.
 */
export function dropOut(sim: Sim, from: string): boolean {
  const restored = restoreArchive(sim, sim.sector.node);
  sim.sector.state = 'deploying';
  const ship = sim.sector.packet?.ship ?? 0;
  sim.events.emit({ type: 'sector.jumped', ship, from, to: sim.sector.node, restored });
  return restored;
}
