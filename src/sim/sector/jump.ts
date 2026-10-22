import { SECTOR_HEIGHT, SECTOR_WIDTH } from '../tuning';
import type { Sim } from '../sim';
import { archiveSector, restoreArchive } from './archive';
import { liftShip } from './packet';
import type { WithDocked } from './members';

/**
 * The one way the player's ship leaves a node (sector refactor step 9): lift it (with what travels along, see `liftShip`) into a
 * packet, freeze the rest of the sector into the archive of the node left, drop the hails and offers of that node, restore the
 * archive of `to` if it has one (else the sector stays empty: the galaxy fills it at deploy time), and wait in state 'deploying'.
 * Callers (`galaxy.jump`, the player's `combat.flee`) validate and pay first. Returns whether an archive was restored.
 */
export function leaveNode(sim: Sim, ship: number, to: string, withDocked: WithDocked = false): boolean {
  const packet = liftShip(sim, ship, { withDocked });
  const from = sim.sector.node;
  archiveSector(sim);
  sim.trade.hails = [];
  sim.trade.offers = [];
  sim.sector.node = to;
  sim.sector.width = SECTOR_WIDTH;
  sim.sector.height = SECTOR_HEIGHT;
  const restored = restoreArchive(sim, to);
  sim.sector.state = 'deploying';
  sim.sector.packet = packet;
  sim.events.emit({ type: 'sector.jumped', ship, from, to, restored });
  return restored;
}
