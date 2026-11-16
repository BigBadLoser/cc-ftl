import type { ModuleDef } from '../sim';
import { groundMountId } from '../sim/modules/groundMount';

/**
 * Ground variants of the weapon and point-defence modules a prefab asteroid base stands out on the rock (#514): the same weapon or
 * point-defence components, power draw, hp and cost as the ship module, on a 3x3 mount (`module.<stem>.ground`, sim/modules/groundMount.ts).
 * Not for the player to build (no blueprint, left out of the build catalog).
 */
const STEMS = [
  'module.burstLaser', 'module.flakCannon', 'module.massDriver', 'module.missileLauncher', 'module.ionCannon', 'module.incendiaryLauncher',
  'module.pointDefense',
] as const;

export function groundMounts(base: Record<string, ModuleDef>): Record<string, ModuleDef> {
  const out: Record<string, ModuleDef> = {};
  for (const id of STEMS) {
    const d = base[id];
    if (!d) continue;
    // Always out (no stowed art), not upgradeable, not built by the player.
    const { blueprint: _b, upgradeSlot: _u, category: _c, deploySec: _d, ...rest } = d;
    out[groundMountId(id)] = { ...rest, name: `${d.name} (ground)`, asset: `${d.asset}.ground`, footprint: [3, 3], solid: true, groundMount: true };
  }
  return out;
}
