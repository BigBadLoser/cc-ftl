import { ammoCount } from '../combat/ammo';
import { CombatC, IonC, WeaponC } from '../combat/components';
import { lockedOut, overchargeActive } from '../combat/heat';
import { OVERCHARGE_WEAPON_CHARGE } from '../combat/heatTuning';
import { mannedConsole, skillOf } from '../combat/operators';

import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { SKILL_STEP, XP_PER_WORK_SEC } from '../tuning';
import { grantXp } from '../crew/xp';
import { shipIdOf } from '../regions';
import { shipById } from '../combat/ships';

/**
 * Weapons charge only while powered, intact, not ion-disabled, with ammo (if they use any) and with the weapons
 * console manned on an active ship, and not while overheated. Operator gunnery speeds charging (an overcharge more). An unmanned weapon keeps its charge.
 */
export function weaponChargeSystem(sim: Sim): void {
  const gunnery = new Map<number, number | null>(); // shipId -> operator skill, null = unmanned
  const opOf = new Map<number, number>();
  const trained = new Set<number>(); // ships whose operator already got this tick's XP (one per second at the console, however many weapons charge)
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const w = sim.world.get(id, WeaponC);
    const def = m && sim.content.weapons?.[sim.content.modules[m.def]?.weapon ?? ''];
    if (!m || !w || !def || w.charge >= 1) continue;
    if (!m.powered || m.hp <= 0 || sim.world.has(id, IonC) || !isDeployed(sim, id)) continue;
    if (shipById(sim, shipIdOf(sim, m))?.state !== 'active') continue;
    const combat = sim.world.get(shipIdOf(sim, m), CombatC);
    if (combat && lockedOut(combat)) continue;
    let skill = gunnery.get(shipIdOf(sim, m));
    if (skill === undefined) {
      const op = mannedConsole(sim, shipIdOf(sim, m), 'weapons');
      skill = op ? skillOf(sim, op.crew, 'gunnery') : null;
      if (op) opOf.set(shipIdOf(sim, m), op.crew);
      gunnery.set(shipIdOf(sim, m), skill);
    }
    if (skill === null) continue;
    if (def.ammo && ammoCount(sim, shipIdOf(sim, m), def.ammo) === 0) continue;
    const ship = shipIdOf(sim, m);
    if (!trained.has(ship)) {
      trained.add(ship);
      grantXp(sim, opOf.get(ship) ?? 0, 'gunnery', XP_PER_WORK_SEC / TICK_HZ);
    }
    const boost = combat && overchargeActive(combat, 'weapons') ? OVERCHARGE_WEAPON_CHARGE : 1;
    w.charge = Math.min(1, w.charge + (boost * (1 + SKILL_STEP * skill)) / (def.chargeSec * TICK_HZ));
  }
}

