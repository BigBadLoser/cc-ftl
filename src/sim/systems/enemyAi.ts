
import { truceHolds } from '../blackmarket/truce';
import { CombatC, ShipC, type Combat, type Ship } from '../combat/components';
import { isDormant } from '../combat/dormant';
import { factionsHostile, isAiFaction, rogueAlly } from '../combat/factions';
import { hostileVehicle, modulesOnGrid, randomModule } from '../combat/targets';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { shipIdOf } from '../regions';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { AboardC, BoarderC, VehicleC } from '../vehicles/components';
import { AI_RETARGET_TICKS, FLEE_BELOW, FTL_CHARGE_SEC } from '../tuning';

/**
 * Enemy doctrine. Hostile and rogue active ships (a) retreat via combat.flee once integrity < FLEE_BELOW and the FTL drive
 * is charged, (b) never hold fire, and (c) every AI_RETARGET_TICKS pick a target on the first live player ship
 * (else any ship at war with them; rogue AIs fight raiders too) when theirs is missing or destroyed: 'weapons' doctrine aims at weapon modules, 'shields' at shield
 * generators, 'random' at any module weighted by max hp. A hostile shuttle of another faction in flight is targeted
 * by the anti-vehicle weapons only (the others keep their ship target). The AI only issues commands, like the player does.
 */
export function enemyAiSystem(sim: Sim): void {
  // Nobody starts a fight at a black market's node while its truce holds.
  if (truceHolds(sim)) return;
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC);
    const combat = sim.world.get(id, CombatC);
    if (!ship || !combat || !isAiFaction(ship.faction) || ship.state !== 'active' || !sim.sector.inCombat || isDormant(ship)) continue;
    if (!ship.immobile && ship.integrity < FLEE_BELOW && combat.ftl >= FTL_CHARGE_SEC) {
      sim.enqueue({ type: 'combat.flee', ship: id });
      continue;
    }
    // A raider whose party is out holds fire: it wants the ship, not a wreck.
    const boarder = sim.world.get(id, BoarderC);
    const sparing = !!boarder?.prefer && partyOut(sim, id, boarder.crew);
    if (combat.hold !== sparing) sim.enqueue({ type: 'combat.setHold', ship: id, hold: sparing });
    if (sparing) continue;
    if (combat.aiTimer > 0) {
      combat.aiTimer--;
      continue;
    }
    const fv = flyingFoeVehicle(sim, ship.faction);
    // A foe shuttle in flight is hunted by the anti-vehicle weapons only; the rest keep shooting the ship below.
    if (fv && combat.vehicleTarget !== fv) {
      sim.enqueue({ type: 'combat.setTarget', ship: id, weaponId: null, targetShip: 0, targetModuleId: 0, targetVehicle: fv });
    }
    const foe = firstFoe(sim, ship.faction);
    if (!foe) continue;
    const t = combat.target;
    const hp = t && sim.world.get(t.moduleId, ModuleC)?.hp;
    if (t && t.ship === foe && t.moduleId !== 0 && (hp ?? 0) > 0) continue;
    combat.aiTimer = AI_RETARGET_TICKS;
    sim.enqueue({ type: 'combat.setTarget', ship: id, weaponId: null, targetShip: foe, targetModuleId: pick(sim, combat, foe) });
  }
}

/** The first shuttle in flight that is hostile to `faction` (the same test targeting keeps it by), or 0. */
function flyingFoeVehicle(sim: Sim, faction: Ship['faction']): number {
  for (const id of sim.world.query(VehicleC)) {
    if (sim.world.get(id, VehicleC)?.state === 'flying' && hostileVehicle(sim, id, faction)) return id;
  }
  return 0;
}

/** Ship id of the first ship still in play at war with `faction` (a player ship first), or 0. */
export function firstFoe(sim: Sim, faction: Ship['faction']): number {
  let other = 0;
  for (const id of sim.world.query(ShipC)) {
    const s = sim.world.get(id, ShipC);
    if (!s || (s.state !== 'active' && s.state !== 'disabled') || !factionsHostile(faction, s.faction)) continue;
    if (faction === 'rogue' && rogueAlly(sim, id)) continue; // the zealots, at any standing
    if (s.faction === 'player') return id;
    other ||= id;
  }
  return other;
}

function pick(sim: Sim, combat: Combat, shipId: number): number {
  const has = (key: 'weapon' | 'shieldGen') => (mid: number): boolean => {
    const m = sim.world.get(mid, ModuleC);
    return !!m && m.hp > 0 && !!sim.content.modules[m.def]?.[key];
  };
  if (combat.doctrine === 'weapons') {
    const id = randomModule(sim, shipId, has('weapon'));
    if (id && has('weapon')(id)) return id;
  } else if (combat.doctrine === 'shields') {
    const id = randomModule(sim, shipId, has('shieldGen'));
    if (id && has('shieldGen')(id)) return id;
  } else {
    const live = modulesOnGrid(sim, shipId).filter((mid) => (sim.world.get(mid, ModuleC)?.hp ?? 0) > 0);
    const weight = (mid: number): number => sim.content.modules[sim.world.get(mid, ModuleC)?.def ?? '']?.maxHp ?? 1;
    const total = live.reduce((s, mid) => s + weight(mid), 0);
    let roll = sim.rng.next() * total;
    for (const mid of live) {
      roll -= weight(mid);
      if (roll < 0) return mid;
    }
  }
  return randomModule(sim, shipId);
}

/** Is a boarding party actually away from its ship: a live member riding the shuttle or standing on another ship? A launch that was dropped leaves them home, so no hold. */
function partyOut(sim: Sim, shipId: number, crew: readonly number[]): boolean {
  return crew.some((c) => {
    if (!sim.world.has(c, CrewC) || sim.world.has(c, DeadC)) return false;
    const pos = sim.world.get(c, PositionC);
    return pos ? shipIdOf(sim, pos) !== shipId : sim.world.has(c, AboardC);
  });
}
