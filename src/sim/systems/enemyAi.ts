import { CombatC, ShipC, type Combat } from '../combat/components';
import { modulesOnGrid, randomModule } from '../combat/targets';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { AI_RETARGET_TICKS, FLEE_BELOW, FTL_CHARGE_SEC } from '../tuning';

/**
 * Enemy doctrine. Hostile active ships (a) retreat via combat.flee once integrity < FLEE_BELOW and the FTL drive
 * is charged, (b) never hold fire, and (c) every AI_RETARGET_TICKS pick a target on the first live player ship
 * when theirs is missing or destroyed: 'weapons' doctrine aims at weapon modules, 'shields' at shield
 * generators, 'random' at any module weighted by max hp. The AI only issues commands, like the player does.
 */
export function enemyAiSystem(sim: Sim): void {
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC);
    const combat = sim.world.get(id, CombatC);
    if (!ship || !combat || ship.faction !== 'hostile' || ship.state !== 'active' || !sim.sector.inCombat) continue;
    if (ship.integrity < FLEE_BELOW && combat.ftl >= FTL_CHARGE_SEC) {
      sim.enqueue({ type: 'combat.flee', gridId: ship.gridId });
      continue;
    }
    if (combat.hold) sim.enqueue({ type: 'combat.setHold', gridId: ship.gridId, hold: false });
    if (combat.aiTimer > 0) {
      combat.aiTimer--;
      continue;
    }
    const foe = firstFoe(sim);
    if (!foe) continue;
    const t = combat.target;
    const hp = t && sim.world.get(t.moduleId, ModuleC)?.hp;
    if (t && t.gridId === foe && t.moduleId !== 0 && (hp ?? 0) > 0) continue;
    combat.aiTimer = AI_RETARGET_TICKS;
    sim.enqueue({ type: 'combat.setTarget', shipGridId: ship.gridId, weaponId: null, targetGridId: foe, targetModuleId: pick(sim, combat, foe) });
  }
}

/** Grid id of the first player ship still in play, or 0. */
function firstFoe(sim: Sim): number {
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (s?.faction === 'player' && (s.state === 'active' || s.state === 'disabled')) return s.gridId;
  }
  return 0;
}

function pick(sim: Sim, combat: Combat, gridId: number): number {
  const has = (key: 'weapon' | 'shieldGen') => (mid: number): boolean => {
    const m = sim.world.get(mid, ModuleC);
    return !!m && m.hp > 0 && !!sim.content.modules[m.def]?.[key];
  };
  if (combat.doctrine === 'weapons') {
    const id = randomModule(sim, gridId, has('weapon'));
    if (id && has('weapon')(id)) return id;
  } else if (combat.doctrine === 'shields') {
    const id = randomModule(sim, gridId, has('shieldGen'));
    if (id && has('shieldGen')(id)) return id;
  } else {
    const live = modulesOnGrid(sim, gridId).filter((mid) => (sim.world.get(mid, ModuleC)?.hp ?? 0) > 0);
    const weight = (mid: number): number => sim.content.modules[sim.world.get(mid, ModuleC)?.def ?? '']?.maxHp ?? 1;
    const total = live.reduce((s, mid) => s + weight(mid), 0);
    let roll = sim.rng.next() * total;
    for (const mid of live) {
      roll -= weight(mid);
      if (roll < 0) return mid;
    }
  }
  return randomModule(sim, gridId);
}
