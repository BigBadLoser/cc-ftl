import type { Command } from '../commands';
import { releaseBedClaim } from '../crew/beds';
import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { isIncapacitated, releaseAssignment } from '../crew/helpers';
import { StorageC } from '../items/components';
import { storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { isTileWalkable } from '../modules/walk';
import { airlockWorking } from '../modules/airlock';
import { AirlockC } from '../modules/airlock';
import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { outsideCrew } from '../eva/shuttle';
import type { Sim } from '../sim';
import { AboardC, EmbarkOrderC, VehicleBayC, VehicleC, type Vehicle } from './components';
import { bayWorking, boardingTile } from './geometry';
import { occupants, spawnVehicle, unboardCrew, undock, vehicleDefOf } from './lifecycle';
import { shipIdOf, shipGrid } from '../regions';

type VehicleCommandType = Extract<Command['type'], `vehicle.${string}`>;
type Handler<T extends VehicleCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

/** Total people a vehicle holds: the pilot plus its passenger capacity. */
function seats(sim: Sim, v: Vehicle): number {
  return (vehicleDefOf(sim, v)?.capacity ?? 0) + 1;
}

/** Start a stowed vehicle's flight at its bay. Returns a reject reason, or null. */
function launch(sim: Sim, id: number, v: Vehicle): string | null {
  if (v.state !== 'stowed') return 'notStowed';
  if (!v.pilot && !v.autopilot) return 'noPilot';
  if (!bayWorking(sim, v.home)) return 'bayDown';
  v.state = 'flying';
  v.dest = null;
  const b = sim.world.get(id, BodyC);
  sim.events.emit({ type: 'vehicle.launched', vehicle: id, ship: v.homeShip, x: b?.x ?? 0, y: b?.y ?? 0 });
  return null;
}

/** Why a vehicle cannot head for this airlock, or null. */
export function dockError(sim: Sim, id: number, airlock: number): string | null {
  const m = sim.world.get(airlock, ModuleC);
  if (!m || !sim.world.has(airlock, AirlockC)) return 'noAirlock';
  if (!airlockWorking(sim, airlock)) return 'airlockDown';
  if (shipById(sim, shipIdOf(sim, m))?.state === 'fled') return 'badTarget';
  for (const other of sim.world.query(VehicleC)) {
    const o = sim.world.get(other, VehicleC) as Vehicle;
    if (other !== id && (o.dock === airlock || (o.dest?.type === 'dock' && o.dest.airlock === airlock))) return 'occupied';
  }
  return null;
}

export const vehicleHandlers: { [T in VehicleCommandType]: Handler<T> } = {
  'vehicle.assign': (sim, cmd) => {
    const bay = sim.world.get(cmd.bay, VehicleBayC);
    const m = sim.world.get(cmd.bay, ModuleC);
    if (!bay || !m) return reject(sim, cmd.type, 'noBay');
    if (bay.vehicle) return reject(sim, cmd.type, 'bayFull');
    if (m.hp <= 0) return reject(sim, cmd.type, 'bayDown');
    for (const sid of sim.world.query(StorageC)) {
      if (shipIdOf(sim, sim.world.get(sid, ModuleC)) !== shipIdOf(sim, m)) continue;
      const stacks = sim.world.get(sid, StorageC)?.stacks ?? [];
      for (const st of stacks) {
        const defId = sim.content.items[st.item]?.vehicle;
        if (!defId || (cmd.item && cmd.item !== st.item) || !sim.content.vehicles?.[defId]) continue;
        if (sim.content.vehicles[defId]?.class !== sim.content.modules[m.def]?.vehicleBay?.class) continue;
        if (storageTake(sim, sid, st.item, 1) < 1) continue;
        spawnVehicle(sim, defId, cmd.bay);
        return;
      }
    }
    reject(sim, cmd.type, 'noShuttle');
  },
  'vehicle.embark': (sim, cmd) => {
    const v = sim.world.get(cmd.vehicle, VehicleC);
    if (!v) return reject(sim, cmd.type, 'noVehicle');
    if (!sim.world.has(cmd.crew, CrewC) || sim.world.has(cmd.crew, DeadC) || sim.world.has(cmd.crew, AboardC)) return reject(sim, cmd.type, 'noCrew');
    if (isIncapacitated(sim, cmd.crew) || !sim.world.has(cmd.crew, PositionC)) return reject(sim, cmd.type, 'incapacitated');
    const at = boardingTile(sim, cmd.vehicle);
    if (!at) return reject(sim, cmd.type, 'notBoardable');
    if (v.state === 'docked' && !airlockWorking(sim, v.dock)) return reject(sim, cmd.type, 'airlockDown');
    if (vehicleDefOf(sim, v)?.crewless) return reject(sim, cmd.type, 'crewless');
    if (occupants(v).length >= seats(sim, v)) return reject(sim, cmd.type, 'full');
    let drafted = sim.world.get(cmd.crew, DraftedC);
    if (!drafted) {
      releaseAssignment(sim, cmd.crew);
      releaseBedClaim(sim, cmd.crew);
      drafted = { target: null };
      sim.world.add(cmd.crew, DraftedC, drafted);
      (sim.world.get(cmd.crew, CrewC) as { activity: string }).activity = 'drafted';
    }
    drafted.target = { x: at.x, y: at.y };
    sim.world.add(cmd.crew, EmbarkOrderC, { vehicle: cmd.vehicle });
  },
  'vehicle.disembark': (sim, cmd) => {
    const v = sim.world.get(cmd.vehicle, VehicleC);
    if (!v) return reject(sim, cmd.type, 'noVehicle');
    const at = boardingTile(sim, cmd.vehicle);
    if (!at) return reject(sim, cmd.type, 'notBoardable');
    if (v.state === 'docked' && !airlockWorking(sim, v.dock)) return reject(sim, cmd.type, 'airlockDown');
    const grid = shipGrid(sim, at.shipId);
    if (!grid || !isTileWalkable(sim, grid, at.x, at.y)) return reject(sim, cmd.type, 'notWalkable');
    if (cmd.crew !== undefined && !occupants(v).includes(cmd.crew)) return reject(sim, cmd.type, 'notAboard');
    // Without a named crew member the passengers leave and the pilot stays at the controls.
    for (const crew of cmd.crew === undefined ? [...v.passengers] : [cmd.crew]) unboardCrew(sim, crew, cmd.vehicle, at);
  },
  'vehicle.launch': (sim, cmd) => {
    const v = sim.world.get(cmd.vehicle, VehicleC);
    if (!v) return reject(sim, cmd.type, 'noVehicle');
    const err = launch(sim, cmd.vehicle, v);
    if (err) reject(sim, cmd.type, err);
  },
  'vehicle.dock': (sim, cmd) => {
    const v = sim.world.get(cmd.vehicle, VehicleC);
    if (!v) return reject(sim, cmd.type, 'noVehicle');
    if (v.state === 'docked') return reject(sim, cmd.type, 'docked');
    if (outsideCrew(sim, cmd.vehicle).length > 0) return reject(sim, cmd.type, 'crewOutside');
    v.hover = 0;
    const err = dockError(sim, cmd.vehicle, cmd.airlock) ?? (v.state === 'stowed' ? launch(sim, cmd.vehicle, v) : null);
    if (err) return reject(sim, cmd.type, err);
    v.dest = { type: 'dock', airlock: cmd.airlock };
  },
  'vehicle.hover': (sim, cmd) => {
    const v = sim.world.get(cmd.vehicle, VehicleC);
    if (!v) return reject(sim, cmd.type, 'noVehicle');
    if (v.state === 'docked') return reject(sim, cmd.type, 'docked');
    const ship = shipById(sim, cmd.ship);
    if (!ship || ship.state === 'fled' || cmd.ship === v.homeShip) return reject(sim, cmd.type, 'badTarget');
    if (!vehicleDefOf(sim, v)?.eva) return reject(sim, cmd.type, 'noEva');
    if (outsideCrew(sim, cmd.vehicle).length > 0) return reject(sim, cmd.type, 'crewOutside');
    const err = v.state === 'stowed' ? launch(sim, cmd.vehicle, v) : null;
    if (err) return reject(sim, cmd.type, err);
    v.hover = 0;
    v.dest = { type: 'hover', ship: cmd.ship };
  },
  'vehicle.undock': (sim, cmd) => {
    const v = sim.world.get(cmd.vehicle, VehicleC);
    if (!v) return reject(sim, cmd.type, 'noVehicle');
    if (v.state !== 'docked') return reject(sim, cmd.type, 'notDocked');
    if (!v.pilot && !v.autopilot) return reject(sim, cmd.type, 'noPilot');
    undock(sim, cmd.vehicle, v);
  },
  'vehicle.return': (sim, cmd) => {
    const v = sim.world.get(cmd.vehicle, VehicleC);
    if (!v) return reject(sim, cmd.type, 'noVehicle');
    if (v.state === 'stowed') return reject(sim, cmd.type, 'stowed');
    if (!bayWorking(sim, v.home)) return reject(sim, cmd.type, 'noBay');
    if (outsideCrew(sim, cmd.vehicle).length > 0) return reject(sim, cmd.type, 'crewOutside');
    v.hover = 0;
    if (v.state === 'docked') {
      if (!v.pilot && !v.autopilot) return reject(sim, cmd.type, 'noPilot');
      undock(sim, cmd.vehicle, v);
    }
    v.dest = { type: 'bay' };
  },
};
