import { shipOf } from '../combat/ships';
import { ModuleC } from '../modules/components';
import { accessTile, hullOutward, hullSide, rotatedSize } from '../modules/footprint';
import { airlockTiles } from '../portals/airlock';
import type { Sim } from '../sim';
import { VehicleBayC, VehicleC } from './components';

export interface DockPoint {
  gridId: number;
  /**
   * Sector position of the docking point: the centre of the collar's tile (the tile one past the hull row; the tile past the
   * outer door for a plain airlock). A docked shuttle sits nose out with its rear ramp against the collar's door; the
   * renderer holds its body further out (shuttleView DOCK_REACH).
   */
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
  const c = t.collar ?? { x: t.outer.x + out.x, y: t.outer.y + out.y };
  return { gridId: m.gridId, x: ship.x + c.x + 0.5, y: ship.y + c.y + 0.5, inside: t.inside };
}

/**
 * Where crew work a docked vehicle's cargo: the keep-out tile in front of one of the airlock's unloaders. `near` picks the
 * closest one (default the first); a plain airlock has none, so the boarding tile serves.
 */
export function cargoTile(sim: Sim, vehicle: number, near?: { x: number; y: number }): { gridId: number; x: number; y: number } | null {
  const v = sim.world.get(vehicle, VehicleC);
  const m = v?.state === 'docked' ? sim.world.get(v.dock, ModuleC) : undefined;
  const def = m && sim.content.modules[m.def];
  const stands = m && def?.airlock ? airlockTiles(def, m).unloaders.map((u) => u.stand) : [];
  if (m && stands.length > 0) {
    const d = (t: { x: number; y: number }): number => (near ? Math.abs(t.x - near.x) + Math.abs(t.y - near.y) : 0);
    const best = stands.reduce((a, b) => (d(b) < d(a) ? b : a));
    return { gridId: m.gridId, ...best };
  }
  return boardingTile(sim, vehicle);
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

/**
 * Where a shuttle holds station beside a grid: `gap` tiles off the side of the ship's bounding box that faces `from`,
 * level with the nearest point of that side (never off a corner, so the hull stays within a short float). A point
 * inside the box leaves through its nearest side. Null if the ship is gone.
 */
export function hoverPoint(sim: Sim, gridId: number, gap: number, from: { x: number; y: number }): { x: number; y: number } | null {
  const s = shipOf(sim, gridId);
  if (!s) return null;
  const nx = Math.min(s.x + s.width, Math.max(s.x, from.x));
  const ny = Math.min(s.y + s.height, Math.max(s.y, from.y));
  let dx = from.x - nx;
  let dy = from.y - ny;
  if (dx === 0 && dy === 0) {
    // Inside: the nearest side.
    const d = [from.x - s.x, s.x + s.width - from.x, from.y - s.y, s.y + s.height - from.y];
    const m = d.indexOf(Math.min(...d));
    [dx, dy] = m === 0 ? [-1, 0] : m === 1 ? [1, 0] : m === 2 ? [0, -1] : [0, 1];
  }
  if (Math.abs(dx) >= Math.abs(dy)) return { x: dx >= 0 ? s.x + s.width + gap : s.x - gap, y: ny };
  return { x: nx, y: dy >= 0 ? s.y + s.height + gap : s.y - gap };
}
