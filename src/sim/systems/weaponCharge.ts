import { ammoCount } from '../combat/ammo';
import { IonC, WeaponC } from '../combat/components';
import { mannedConsole, skillOf } from '../combat/operators';

import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { SKILL_STEP } from '../tuning';
import { shipIdOf } from '../regions';
import { shipById } from '../combat/ships';

/**
 * Weapons charge only while powered, intact, not ion-disabled, with ammo (if they use any) and with the weapons
 * console manned on an active ship. Operator gunnery speeds charging. An unmanned weapon keeps its charge.
 */
export function weaponChargeSystem(sim: Sim): void {
  const gunnery = new Map<number, number | null>(); // shipId -> operator skill, null = unmanned
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const w = sim.world.get(id, WeaponC);
    const def = m && sim.content.weapons?.[sim.content.modules[m.def]?.weapon ?? ''];
    if (!m || !w || !def || w.charge >= 1) continue;
    if (!m.powered || m.hp <= 0 || sim.world.has(id, IonC) || !isDeployed(sim, id)) continue;
    if (shipById(sim, shipIdOf(sim, m))?.state !== 'active') continue;
    let skill = gunnery.get(shipIdOf(sim, m));
    if (skill === undefined) {
      const op = mannedConsole(sim, shipIdOf(sim, m), 'weapons');
      skill = op ? skillOf(sim, op.crew, 'gunnery') : null;
      gunnery.set(shipIdOf(sim, m), skill);
    }
    if (skill === null) continue;
    if (def.ammo && ammoCount(sim, shipIdOf(sim, m), def.ammo) === 0) continue;
    w.charge = Math.min(1, w.charge + (1 + SKILL_STEP * skill) / (def.chargeSec * TICK_HZ));
  }
}

