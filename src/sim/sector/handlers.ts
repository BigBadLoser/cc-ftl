import type { Command } from '../commands';
import { CombatC, ShipC } from '../combat/components';
import { stampShip } from '../combat/ships';
import { placementGapError } from '../regions';
import type { Sim } from '../sim';
import { isLive } from '../trade/deals';
import { FTL_CHARGE_SEC, SECTOR_HEIGHT, SECTOR_WIDTH } from '../tuning';
import { archiveSector, restoreArchive } from './archive';
import { liftShip } from './packet';

type SectorCommandType = Extract<Command['type'], `sector.${string}`>;
type Handler<T extends SectorCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const sectorHandlers: { [T in SectorCommandType]: Handler<T> } = {
  'sector.jump': (sim, cmd) => {
    if (sim.sector.state !== 'active') return reject(sim, cmd.type, 'deploying');
    const ship = sim.world.get(cmd.ship, ShipC);
    const combat = sim.world.get(cmd.ship, CombatC);
    if (!ship || ship.faction !== 'player' || ship.state !== 'active' || !combat) return reject(sim, cmd.type, 'notPlayerShip');
    if (combat.ftl < FTL_CHARGE_SEC) return reject(sim, cmd.type, 'notCharged');
    if (!Number.isInteger(cmd.node) || cmd.node === sim.sector.node) return reject(sim, cmd.type, 'badNode');
    // A deal in flight names ships, shuttles and escrow of this sector: finish or cancel it first.
    if (sim.trade.deals.some(isLive)) return reject(sim, cmd.type, 'tradeInProgress');
    combat.ftl = 0;
    const packet = liftShip(sim, cmd.ship, { withDocked: cmd.withDocked ?? false });
    const from = sim.sector.node;
    archiveSector(sim);
    sim.trade.hails = [];
    sim.trade.offers = [];
    sim.sector.node = cmd.node;
    sim.sector.width = SECTOR_WIDTH;
    sim.sector.height = SECTOR_HEIGHT;
    const restored = restoreArchive(sim, cmd.node);
    sim.sector.state = 'deploying';
    sim.sector.packet = packet;
    sim.events.emit({ type: 'sector.jumped', ship: cmd.ship, from, to: cmd.node, restored });
  },
  'sector.deploy': (sim, cmd) => {
    const packet = sim.sector.packet;
    if (sim.sector.state !== 'deploying' || !packet) return reject(sim, cmd.type, 'notDeploying');
    if (!Number.isInteger(cmd.x) || !Number.isInteger(cmd.y)) return reject(sim, cmd.type, 'badValue');
    if (cmd.x < 0 || cmd.y < 0 || cmd.x + packet.w > sim.sector.width || cmd.y + packet.h > sim.sector.height) {
      return reject(sim, cmd.type, 'outOfBounds');
    }
    const gap = placementGapError(sim, { x: cmd.x, y: cmd.y, w: packet.w, h: packet.h });
    if (gap) return reject(sim, cmd.type, gap);
    const ship = stampShip(sim, packet, { x: cmd.x, y: cmd.y });
    sim.sector.state = 'active';
    delete sim.sector.packet;
    sim.events.emit({ type: 'sector.deployed', ship, x: cmd.x, y: cmd.y });
  },
};
