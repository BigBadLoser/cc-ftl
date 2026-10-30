import { ModuleC } from '../modules/components';
import { turretPosition } from './geometry';
import { operatorSkill } from './operators';
import { overchargeActive } from './heat';
import { OVERCHARGE_WEAPON_CHARGE } from './heatTuning';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { SKILL_STEP } from '../tuning';
import { CombatC, ProjectileC, WeaponC } from './components';

/** Seconds until a shot in flight lands. Read-only. */
export function projectileEtaSec(sim: Sim, projectileId: number): number | null {
  const p = sim.world.get(projectileId, ProjectileC);
  return p ? Math.max(0, (1 - p.t) / Math.max(1e-6, p.dt) / TICK_HZ) : null;
}

/**
 * Seconds until a weapon's committed shot lands: the rest of its charge (at the rate it charges now, operator skill and overcharge included) plus the
 * flight to the centre of the aim area. Read-only; null when the weapon has no commit. It is an estimate (firing aims at the exact module, and the
 * charge stalls when the weapon cannot charge), which is what a countdown needs.
 */
export function commitEtaSec(sim: Sim, weaponId: number): number | null {
  const w = sim.world.get(weaponId, WeaponC);
  const m = sim.world.get(weaponId, ModuleC);
  const wdef = m && sim.content.weapons?.[sim.content.modules[m.def]?.weapon ?? ''];
  const c = w?.commit;
  if (!w || !m || !wdef || !c) return null;
  const ship = shipIdOf(sim, m);
  const combat = sim.world.get(ship, CombatC);
  const boost = combat && overchargeActive(combat, 'weapons') ? OVERCHARGE_WEAPON_CHARGE : 1;
  const rate = (boost * (1 + SKILL_STEP * operatorSkill(sim, ship, 'weapons'))) / wdef.chargeSec;
  const charging = Math.max(0, 1 - w.charge) / rate;
  const from = turretPosition(sim, weaponId);
  const dist = from ? Math.max(1, Math.hypot(c.x + c.w / 2 - from.x, c.y + c.h / 2 - from.y)) : 1;
  return charging + dist / wdef.speed;
}

/** A weapon's stable colour slot: its rank by entity id among the weapons of its ship, so a shot keeps its colour while others land. */
export function shotSlot(sim: Sim, weaponId: number): number {
  const m = sim.world.get(weaponId, ModuleC);
  if (!m) return 0;
  const ship = shipIdOf(sim, m);
  let rank = 0;
  for (const id of sim.world.query(WeaponC)) {
    const o = sim.world.get(id, ModuleC);
    if (id < weaponId && o && shipIdOf(sim, o) === ship) rank++;
  }
  return rank;
}
