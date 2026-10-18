import { CombatC, ShipC, type Combat, type Ship } from '../combat/components';
import { factionsHostile, isAiFaction } from '../combat/factions';
import { modulesOnGrid, randomModule } from '../combat/targets';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { vehicleFaction } from '../vehicles/lifecycle';
import { AI_RETARGET_TICKS, FLEE_BELOW, FTL_CHARGE_SEC } from '../tuning';

/**
 * Enemy doctrine. Hostile and rogue active ships (a) retreat via combat.flee once integrity < FLEE_BELOW and the FTL drive
 * is charged, (b) never hold fire, and (c) every AI_RETARGET_TICKS pick a target on the first live player ship
 * (else any ship at war with them; rogue AIs fight raiders too) when theirs is missing or destroyed: 'weapons' doctrine aims at weapon modules, 'shields' at shield
 * generators, 'random' at any module weighted by max hp. A hostile shuttle of another faction in flight is targeted
 * before any ship. The AI only issues commands, like the player does.
 */
export function enemyAiSystem(sim: Sim): void {
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC);
    const combat = sim.world.get(id, CombatC);
    if (!ship || !combat || !isAiFaction(ship.faction) || ship.state !== 'active' || !sim.sector.inCombat) continue;
    if (ship.integrity < FLEE_BELOW && combat.ftl >= FTL_CHARGE_SEC) {
      sim.enqueue({ type: 'combat.flee', gridId: ship.gridId });
      continue;
    }
    if (combat.hold) sim.enqueue({ type: 'combat.setHold', gridId: ship.gridId, hold: false });
    if (combat.aiTimer > 0) {
      combat.aiTimer--;
      continue;
    }
    const fv = flyingFoeVehicle(sim, ship.faction);
    if (fv) {
      // A foe shuttle in flight is shot down first (all weapons; the ship-wide target).
      if (combat.target?.vehicle !== fv) {
        combat.aiTimer = AI_RETARGET_TICKS;
        sim.enqueue({ type: 'combat.setTarget', shipGridId: ship.gridId, weaponId: null, targetGridId: 0, targetModuleId: 0, targetVehicle: fv });
      }
      continue;
    }
    const foe = firstFoe(sim, ship.faction);
    if (!foe) continue;
    const t = combat.target;
    const hp = t && sim.world.get(t.moduleId, ModuleC)?.hp;
    if (t && t.gridId === foe && t.moduleId !== 0 && (hp ?? 0) > 0) continue;
    combat.aiTimer = AI_RETARGET_TICKS;
    sim.enqueue({ type: 'combat.setTarget', shipGridId: ship.gridId, weaponId: null, targetGridId: foe, targetModuleId: pick(sim, combat, foe) });
  }
}

/** The first shuttle in flight that belongs to a different faction, or 0. */
function flyingFoeVehicle(sim: Sim, faction: string): number {
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    if (v?.state === 'flying' && vehicleFaction(sim, v) !== faction) return id;
  }
  return 0;
}

/** Grid id of the first ship still in play at war with `faction` (a player ship first), or 0. */
function firstFoe(sim: Sim, faction: Ship['faction']): number {
  let other = 0;
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (!s || (s.state !== 'active' && s.state !== 'disabled') || !factionsHostile(faction, s.faction)) continue;
    if (s.faction === 'player') return s.gridId;
    other ||= s.gridId;
  }
  return other;
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
