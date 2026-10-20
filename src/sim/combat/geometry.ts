import { ModuleC } from '../modules/components';
import { rotatedSize } from '../modules/footprint';
import type { Sim } from '../sim';
import { shipOf } from './ships';

/** Centre of a module in sector coordinates (tiles), or null if the module or its ship is gone. */
export function moduleCenter(sim: Sim, moduleId: number): { x: number; y: number } | null {
  const m = sim.world.get(moduleId, ModuleC);
  const def = m && sim.content.modules[m.def];
  const ship = m && shipOf(sim, m.gridId);
  if (!m || !def || !ship) return null;
  const [w, h] = rotatedSize(def, m.rot);
  return { x: m.x + w / 2, y: m.y + h / 2 };
}

/** Roughly normal noise with sigma 1, from three uniform draws (Irwin-Hall), via sim.rng. */
export function gauss(sim: Sim): number {
  return (sim.rng.next() + sim.rng.next() + sim.rng.next() - 1.5) * 2;
}

/** Quantise a direction (dx, dy) in grid space to one of 8 turret aims (see Weapon.aim). */
export function aimDirection(dx: number, dy: number): number {
  return (((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8);
}

/** Where a weapon's shots start: its roof turret, centred above the bay (sector tiles). */
export function turretPosition(sim: Sim, moduleId: number): { x: number; y: number } | null {
  return moduleCenter(sim, moduleId);
}
