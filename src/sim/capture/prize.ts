import { CaptureProgressC, CombatC, PrizeC, ShipC, WeaponC, type Faction, type Ship } from '../combat/components';
import { hullSum } from '../combat/hull';
import { LOOT_GOODS } from '../blackmarket/services';
import { LOOT_MAX, LOOT_MIN, LOOT_PER_VALUE } from '../blackmarket/tuning';
import { StorageC } from '../items/components';
import { spillItems } from '../items/stacks';
import { storageAdd } from '../items/storage';

import { wreckShip } from '../combat/wreck';
import { CrewC, DeadC, DownedC, DraftedC, PathC, PositionC, type Crew } from '../crew/components';
import { releaseAssignment } from '../crew/helpers';
import { AllegianceC, FighterC, PrisonerC, SurrenderedC } from '../fight/components';
import { dropWeapon } from '../fight/equip';
import { ModuleC } from '../modules/components';
import { InertC } from '../robots/components';
import type { Sim } from '../sim';
import { PRIZE_VALUE_PER_COST, PRIZE_VALUE_PER_WALL_HP } from '../tuning';
import { shipIdOf, shipGrid } from '../regions';

/** Hull value estimate of a grid: module build costs scaled by hp, plus wall integrity. For a future ship broker. */
export function prizeValue(sim: Sim, shipId: number): number {
  let value = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && shipIdOf(sim, m) === shipId ? sim.content.modules[m.def] : undefined;
    if (!m || !def) continue;
    const cost = (def.cost ?? []).reduce((n, q) => n + q.count, 0);
    value += cost * PRIZE_VALUE_PER_COST * Math.max(0, m.hp) / Math.max(1, def.maxHp);
  }
  const grid = shipGrid(sim, shipId);
  if (grid?.has('hp')) value += hullSum(grid) * PRIZE_VALUE_PER_WALL_HP;
  return Math.round(value);
}

/** Hold a surrendered or downed crew member in place as a prisoner (they stay subdued even if they recover). */
function imprison(sim: Sim, crew: number, ship: number): void {
  releaseAssignment(sim, crew);
  sim.world.remove(crew, DraftedC);
  const f = sim.world.get(crew, FighterC);
  if (f) Object.assign(f, { mode: 'idle', target: 0, ordered: 0 });
  dropWeapon(sim, crew);
  const path = sim.world.get(crew, PathC);
  if (path) path.steps = [];
  if (!sim.world.has(crew, SurrenderedC)) sim.world.add(crew, SurrenderedC, { tick: sim.tick });
  sim.world.add(crew, PrisonerC, { tick: sim.tick });
  (sim.world.get(crew, CrewC) as Crew).activity = sim.world.has(crew, DownedC) ? 'downed' : sim.world.has(crew, InertC) ? 'inert' : 'idle';
  sim.events.emit({ type: 'crew.imprisoned', crew, ship });
}

/**
 * Loot taken from a captured ship is contraband: the prize's hold gets looted goods worth a share of its hull value (LOOT_PER_VALUE of hull value a
 * unit, LOOT_MIN to LOOT_MAX), put in its first storage module with room, for the crew to strip. Nothing is added to a ship with no storage.
 */
function stockLoot(sim: Sim, entity: number, hullValue: number): void {
  if (!sim.content.items[LOOT_GOODS]) return;
  let left = Math.min(LOOT_MAX, Math.max(LOOT_MIN, Math.round(hullValue / LOOT_PER_VALUE)));
  for (const id of [...sim.world.query(StorageC, ModuleC)].sort((a, b) => a - b)) {
    if (left <= 0) break;
    if (shipIdOf(sim, sim.world.get(id, ModuleC)) === entity) left -= storageAdd(sim, id, LOOT_GOODS, left);
  }
  // No hold with room: the loot lies on the deck beside a module.
  const at = left > 0 ? [...sim.world.query(ModuleC)].sort((a, b) => a - b).map((id) => sim.world.get(id, ModuleC)).find((m) => m && shipIdOf(sim, m) === entity) : undefined;
  if (at) spillItems(sim, entity, at.x, at.y, LOOT_GOODS, left);
}

/** Flip a ship to the player as an inactive prize: weapons dead, AI off, its subdued crew become prisoners. */
export function capturePrize(sim: Sim, entity: number): void {
  const ship = sim.world.get(entity, ShipC) as Ship;
  const from: Faction = ship.faction;
  ship.faction = 'player';
  ship.state = 'prize';
  sim.world.remove(entity, CaptureProgressC);
  const hullValue = prizeValue(sim, entity);
  sim.world.add(entity, PrizeC, { capturedTick: sim.tick, from, hullValue });
  stockLoot(sim, entity, hullValue);
  for (const id of sim.world.query(WeaponC)) {
    const w = sim.world.get(id, WeaponC);
    if (w && shipIdOf(sim, sim.world.get(id, ModuleC)) === entity) Object.assign(w, { charge: 0, shotsLeft: 0, target: null, volleyTarget: null });
  }
  const combat = sim.world.get(entity, CombatC);
  if (combat) Object.assign(combat, { target: null, volley: false, hold: true });
  for (const id of sim.world.query(CrewC, PositionC)) {
    const pos = sim.world.get(id, PositionC);
    if (shipIdOf(sim, pos) !== entity) continue;
    const faction = sim.world.get(id, AllegianceC)?.faction;
    if (faction === from) {
      if (sim.world.has(id, SurrenderedC) || sim.world.has(id, DownedC) || sim.world.has(id, InertC)) imprison(sim, id, entity);
    } else if (faction === 'player') {
      sim.world.remove(id, DraftedC); // the boarders go back to work (salvage) instead of standing at attention
    }
  }
  sim.events.emit({ type: 'ship.captured', ship: entity, by: 'player', from });
}

/** Scuttle a prize into a derelict wreck. Returns a reject reason, or null. */
export function scuttle(sim: Sim, shipId: number): string | null {
  const entity = shipId;
  const ship = sim.world.get(entity, ShipC);
  if (!ship || ship.state !== 'prize') return 'notPrize';
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (shipIdOf(sim, sim.world.get(id, PositionC)) === shipId && sim.world.get(id, AllegianceC)?.faction === 'player'
      && !sim.world.has(id, PrisonerC) && !sim.world.has(id, DeadC)) return 'crewAboard';
  }
  sim.world.remove(entity, PrizeC);
  wreckShip(sim, entity);
  return null;
}
