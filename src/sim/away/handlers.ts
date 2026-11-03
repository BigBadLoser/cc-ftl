import type { Command } from '../commands';
import { homeShip, shipById } from '../combat/ships';
import { ferryFree } from '../ferry/pick';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { boardingTile } from '../vehicles/geometry';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { AwaySiteC, SiteRunC, type AwaySite } from './components';

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

/**
 * Open an away site on `ship` for `owner`, served by `vehicle` or the lowest free shuttle that can serve one (`siteShuttleOk`). Returns the
 * shuttle, or the reason it could not: `noShuttle`. The caller has checked the ship.
 */
export function openSite(sim: Sim, ship: number, owner: AwaySite['owner'], vehicle?: number): number | 'noShuttle' {
  const v = vehicle ?? [...sim.world.query(VehicleC)].sort((a, b) => a - b).find((id) => siteShuttleOk(sim, id)) ?? 0;
  if (!v || !siteShuttleOk(sim, v)) return 'noShuttle';
  sim.world.add(ship, AwaySiteC, { owner, status: 'open', vehicle: v, since: sim.tick });
  sim.world.add(v, SiteRunC, { site: ship, phase: 'board', timer: 0, lastTrip: 0 });
  sim.events.emit({ type: 'away.opened', ship, vehicle: v });
  return v;
}

export const awayHandlers: { [T in AwayCommandType]: Handler<T> } = {
  'away.open': (sim, cmd) => {
    const ship = shipById(sim, cmd.ship);
    if (!ship || cmd.ship === homeShip(sim) || ship.faction === 'player') return reject(sim, cmd.type, 'badTarget');
    if (sim.world.has(cmd.ship, AwaySiteC)) return reject(sim, cmd.type, 'open');
    if (openSite(sim, cmd.ship, 'debug', cmd.vehicle) === 'noShuttle') reject(sim, cmd.type, 'noShuttle');
  },
  'away.recall': (sim, cmd) => {
    const s = sim.world.get(cmd.ship, AwaySiteC);
    if (!s) return reject(sim, cmd.type, 'noSite');
    s.status = 'closing';
  },
};
