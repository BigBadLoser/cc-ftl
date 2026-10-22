import type { Command } from '../commands';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { AboardC } from '../vehicles/components';
import { VehicleC } from '../vehicles/components';
import { cargoCount } from '../vehicles/cargo';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { FerryC } from './components';
import { ferryFree, ferryMode, isFerryRegion, pickFerryShuttle, regionItems } from './pick';

type FerryCommandType = Extract<Command['type'], `ferry.${string}`>;
type Handler<T extends FerryCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const ferryHandlers: { [T in FerryCommandType]: Handler<T> } = {
  'ferry.order': (sim, cmd) => {
    const id = cmd.vehicle || pickFerryShuttle(sim);
    const v = sim.world.get(id, VehicleC);
    const def = v && vehicleDefOf(sim, v);
    if (!v || !def) return reject(sim, cmd.type, id ? 'noVehicle' : 'noShuttle');
    if (!ferryFree(sim, id)) return reject(sim, cmd.type, 'busy');
    if (cmd.from === cmd.to) return reject(sim, cmd.type, 'sameRegion');
    if (!isFerryRegion(sim, cmd.from) || !isFerryRegion(sim, cmd.to)) return reject(sim, cmd.type, 'badRegion');
    if (!ferryMode(sim, cmd.from, id) || !ferryMode(sim, cmd.to, id)) return reject(sim, cmd.type, 'noAirlock');
    const crew = [...new Set(cmd.crew ?? [])];
    for (const c of crew) {
      const pos = sim.world.get(c, PositionC);
      if (!sim.world.has(c, CrewC) || sim.world.has(c, DeadC) || sim.world.has(c, AboardC) || !pos || isIncapacitated(sim, c)) return reject(sim, cmd.type, 'noCrew');
      if (shipIdOf(sim, pos) !== cmd.from) return reject(sim, cmd.type, 'otherRegion');
    }
    if (crew.length > def.capacity + 1) return reject(sim, cmd.type, 'full');
    // Cargo lines are clipped to what the pickup region holds and to the hold.
    const items: { item: string; count: number }[] = [];
    let room = def.cargo ?? 0;
    if ((cmd.items?.length ?? 0) > 0 && cargoCount(v) > 0) return reject(sim, cmd.type, 'holdBusy');
    for (const l of cmd.items ?? []) {
      if (!sim.content.items[l.item] || !Number.isInteger(l.count) || l.count <= 0) return reject(sim, cmd.type, 'badLine');
      const n = Math.min(l.count, regionItems(sim, cmd.from, l.item) - (items.find((x) => x.item === l.item)?.count ?? 0), room);
      if (n <= 0) continue;
      items.push({ item: l.item, count: n });
      room -= n;
    }
    if (items.length === 0 && crew.length === 0) return reject(sim, cmd.type, 'nothing');
    v.autopilot = true;
    v.hover = 0;
    sim.world.add(id, FerryC, { from: cmd.from, to: cmd.to, items, crew, phase: 'toFrom', timer: 0 });
    sim.events.emit({ type: 'ferry.started', vehicle: id, from: cmd.from, to: cmd.to, items: items.reduce((n, l) => n + l.count, 0), crew: crew.length });
  },
  'ferry.cancel': (sim, cmd) => {
    const f = sim.world.get(cmd.vehicle, FerryC);
    if (!f) return reject(sim, cmd.type, 'noRun');
    f.phase = 'home';
    f.reason = 'cancelled';
    f.timer = 0;
    f.crew = [];
    const v = sim.world.get(cmd.vehicle, VehicleC);
    if (v) v.outbound = false;
  },
};
