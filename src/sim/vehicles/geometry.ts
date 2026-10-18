import { shipOf } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { accessTile, hullOutward, hullSide, rotatedSize } from '../modules/footprint';
import { airlockTiles } from '../portals/airlock';
import type { Sim } from '../sim';
import { VehicleBayC, VehicleC } from './components';

export interface DockPoint {
  gridId: number;
  /** Sector position just outside the outer door. */
  x: number;
  y: number;
  /** The ship tile past the inner door where passengers come in. */
  inside: { x: number; y: number };
}

/** Where a shuttle latches on to an airlock, or null if the airlock or its ship is gone. */
export function dockPoint(sim: Sim, airlock: number): DockPoint | null {
  const m = sim.world.get(airlock, ModuleC);
  const def = m && sim.content.modules[m.def];
  const ship = m && shipOf(sim, m.gridId);
  if (!m || !def?.airlock || !ship) return null;
  const t = airlockTiles(def, m);
  const out = hullOutward(hullSide(def, m.rot) ?? 'n');
  return { gridId: m.gridId, x: ship.x + t.outer.x + 0.5 + out.x, y: ship.y + t.outer.y + 0.5 + out.y, inside: t.inside };
}

/** Where crew stand to board or leave a vehicle: its bay's access tile (stowed) or the docked airlock's inside tile. */
export function boardingTile(sim: Sim, vehicle: number): { gridId: number; x: number; y: number } | null {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return null;
  if (v.state === 'docked') {
    const p = dockPoint(sim, v.dock);
    return p ? { gridId: p.gridId, ...p.inside } : null;
  }
  if (v.state !== 'stowed') return null;
  const m = sim.world.get(v.home, ModuleC);
  const def = m && sim.content.modules[m.def];
  const t = m && def && accessTile(def, m.x, m.y, m.rot);
  return m && t ? { gridId: m.gridId, x: t.x, y: t.y } : null;
}

/** Centre of a bay in sector tiles, or null. */
export function bayCenter(sim: Sim, bay: number): { x: number; y: number } | null {
  const m = sim.world.get(bay, ModuleC);
  const def = m && sim.content.modules[m.def];
  const ship = m && shipOf(sim, m.gridId);
  if (!m || !def?.vehicleBay || !ship) return null;
  const [w, h] = rotatedSize(def, m.rot);
  return { x: ship.x + m.x + w / 2, y: ship.y + m.y + h / 2 };
}

/** True if the module is a bay that is intact and enabled. */
export function bayWorking(sim: Sim, bay: number): boolean {
  const m = sim.world.get(bay, ModuleC);
  return !!m && m.hp > 0 && m.enabled && sim.world.has(bay, VehicleBayC);
}
