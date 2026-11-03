import type { Command } from '../commands';
import { homeShip, shipById } from '../combat/ships';
import { ferryFree } from '../ferry/pick';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { boardingTile } from '../vehicles/geometry';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { AwaySiteC, SiteRunC } from './components';

type AwayCommandType = Extract<Command['type'], `away.${string}`>;
type Handler<T extends AwayCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/**
 * A shuttle that can serve a site: free (ferry rules), fit for EVA (it hovers; its suits are for those aboard who breathe), stowed in a bay
 * on the home ship (its crew walk to it).
 */
export function siteShuttleOk(sim: Sim, id: number): boolean {
  const v = sim.world.get(id, VehicleC);
  if (!v || v.state !== 'stowed' || !vehicleDefOf(sim, v)?.eva || !ferryFree(sim, id)) return false;
  return boardingTile(sim, id)?.shipId === homeShip(sim);
}

export const awayHandlers: { [T in AwayCommandType]: Handler<T> } = {
  'away.open': (sim, cmd) => {
    const ship = shipById(sim, cmd.ship);
    if (!ship || cmd.ship === homeShip(sim) || ship.faction === 'player') return reject(sim, cmd.type, 'badTarget');
    if (sim.world.has(cmd.ship, AwaySiteC)) return reject(sim, cmd.type, 'open');
    const vehicle = cmd.vehicle ?? [...sim.world.query(VehicleC)].sort((a, b) => a - b).find((id) => siteShuttleOk(sim, id)) ?? 0;
    if (!vehicle || !siteShuttleOk(sim, vehicle)) return reject(sim, cmd.type, 'noShuttle');
    sim.world.add(cmd.ship, AwaySiteC, { owner: 'debug', status: 'open', vehicle, since: sim.tick });
    sim.world.add(vehicle, SiteRunC, { site: cmd.ship, phase: 'board', timer: 0, lastTrip: 0 });
    sim.events.emit({ type: 'away.opened', ship: cmd.ship, vehicle });
  },
  'away.recall': (sim, cmd) => {
    const s = sim.world.get(cmd.ship, AwaySiteC);
    if (!s) return reject(sim, cmd.type, 'noSite');
    s.status = 'closing';
  },
};
