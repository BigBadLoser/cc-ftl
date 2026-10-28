import { ModuleC } from '../modules/components';
import { rotatedSize } from '../modules/footprint';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { COMMIT_MAX_FRACTION, COMMIT_WINDOW_SEC } from '../tuning';
import { WeaponC, type Commit, type Target } from './components';

/** Charge level (0..1) at which a weapon with `chargeSec` commits its aim: the last COMMIT_WINDOW_SEC, but at most COMMIT_MAX_FRACTION of the charge. */
export function commitCharge(chargeSec: number): number {
  return 1 - Math.min(COMMIT_MAX_FRACTION, COMMIT_WINDOW_SEC / Math.max(0.001, chargeSec));
}

/** The area a shot at `t` is aimed at: a blind tile as set, else the module's footprint; null if the target is not a ship tile. */
export function aimRectOf(sim: Sim, t: Target): { x: number; y: number; w: number; h: number } | null {
  if (t.vehicle) return null;
  if (t.tile) return { x: t.tile.x, y: t.tile.y, w: 1, h: 1 };
  const m = t.moduleId ? sim.world.get(t.moduleId, ModuleC) : undefined;
  const def = m && sim.content.modules[m.def];
  if (!m || !def || shipIdOf(sim, m) !== t.ship) return null;
  const [w, h] = rotatedSize(def, m.rot);
  return { x: m.x, y: m.y, w, h };
}

/** True if a stored commit can still be honoured: its target ship exists and its module (if any) is still intact on it. */
export function commitValid(sim: Sim, c: Commit): boolean {
  if (c.target.tile || !c.target.moduleId) return true;
  const m = sim.world.get(c.target.moduleId, ModuleC);
  return !!m && m.hp > 0 && shipIdOf(sim, m) === c.target.ship;
}

/**
 * Keeps an enemy weapon's telegraph: inside the last window of its charge it commits to the resolved target and stores the aim area
 * (resolving draws rng only for an "any module" target, as firing would have). It drops the commit when the weapon cannot charge on (`ready` false), the charge is below the window, or the target is gone.
 * Returns the commit that stands.
 */
export function updateCommit(sim: Sim, weaponId: number, chargeSec: number, ready: boolean, resolve: () => Target | null): Commit | null {
  const w = sim.world.get(weaponId, WeaponC);
  if (!w) return null;
  const start = commitCharge(chargeSec);
  if (!ready || w.charge < start || !sim.sector.inCombat) {
    w.commit = null;
    return null;
  }
  if (w.commit && commitValid(sim, w.commit)) return w.commit;
  const target = resolve();
  const rect = target && aimRectOf(sim, target);
  w.commit = target && rect ? { target: { ...target }, ...rect, from: start } : null;
  return w.commit;
}
