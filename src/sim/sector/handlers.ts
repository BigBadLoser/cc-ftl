import type { Command } from '../commands';
import { stampShip } from '../combat/ships';
import { placementGapError } from '../regions';
import { onDeployed } from '../galaxy/deploy';
import type { Sim } from '../sim';

type SectorCommandType = Extract<Command['type'], `sector.${string}`>;
type Handler<T extends SectorCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const sectorHandlers: { [T in SectorCommandType]: Handler<T> } = {
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
    // The galaxy fills a node the player enters for the first time and draws the arrival event.
    onDeployed(sim);
  },
};
