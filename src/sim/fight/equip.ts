import { CrewC, DraftedC, PathC, PositionC, type Position } from '../crew/components';
import { clearPath, isIncapacitated, origin, releaseAssignment } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import { dropCarried, spillItems } from '../items/stacks';
import { storageAdd, storageCount, storageTake } from '../items/storage';
import { StorageC } from '../items/components';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import type { Sim } from '../sim';
import { EquipC, EquipOrderC } from './components';
import { handDefOf } from './weapons';
import { shipIdOf } from '../regions';

/** The nearest storage module on the grid holding `item`, or 0. */
function nearestStock(sim: Sim, shipId: number, at: { x: number; y: number }, item: string): number {
  let best = 0;
  let bestD = Infinity;
  for (const id of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== shipId || m.hp <= 0 || storageCount(sim, id, item) <= 0) continue;
    const d = Math.max(Math.abs(m.x - at.x), Math.abs(m.y - at.y));
    if (d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/** True if the crew member stands next to (or on) a tile of the storage module. */
function atStorage(sim: Sim, pos: Position, storage: number): boolean {
  const m = sim.world.get(storage, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def || shipIdOf(sim, m) !== shipIdOf(sim, pos)) return false;
  return footprintTiles(def, m.x, m.y, m.rot).some((t) => Math.max(Math.abs(t.x - pos.x), Math.abs(t.y - pos.y)) <= 1);
}

/** Send a crew member to fetch `item` from storage. Returns a rejection reason, or null when the order is on. */
export function orderEquip(sim: Sim, crew: number, item: string): string | null {
  if (!sim.world.has(crew, CrewC)) return 'noCrew';
  if (!handDefOf(sim, item)) return 'notAWeapon';
  const pos = sim.world.get(crew, PositionC);
  if (!pos || isIncapacitated(sim, crew)) return 'incapacitated';
  if (sim.world.get(crew, EquipC)?.weapon === item) return 'alreadyEquipped';
  const storage = nearestStock(sim, shipIdOf(sim, pos), origin(pos), item);
  if (!storage) return 'noStock';
  releaseAssignment(sim, crew);
  dropCarried(sim, crew);
  sim.world.add(crew, EquipOrderC, { item, storage });
  return null;
}

/** Put the wielded weapon on the floor at the crew member's feet. */
export function dropWeapon(sim: Sim, crew: number): string | null {
  const eq = sim.world.get(crew, EquipC);
  const pos = sim.world.get(crew, PositionC);
  if (!eq?.weapon) return null;
  const item = eq.weapon;
  eq.weapon = null;
  if (pos) spillItems(sim, shipIdOf(sim, pos), pos.toX, pos.toY, item, 1);
  return item;
}

/** Walk crew with an equip order to their storage and take the weapon (swapping out the old one). */
export function equipOrders(sim: Sim): void {
  for (const id of sim.world.query(EquipOrderC, PositionC)) {
    const order = sim.world.get(id, EquipOrderC);
    const pos = sim.world.get(id, PositionC);
    const path = sim.world.get(id, PathC);
    if (!order || !pos || !path) continue;
    const cancel = (): void => {
      sim.world.remove(id, EquipOrderC);
      clearPath(sim, id);
    };
    if (isIncapacitated(sim, id) || storageCount(sim, order.storage, order.item) <= 0) {
      cancel();
      continue;
    }
    if (atStorage(sim, pos, order.storage) && pos.toX === pos.x && pos.toY === pos.y) {
      storageTake(sim, order.storage, order.item, 1);
      const eq = sim.world.get(id, EquipC);
      if (eq) {
        if (eq.weapon && storageAdd(sim, order.storage, eq.weapon, 1) < 1) spillItems(sim, shipIdOf(sim, pos), pos.x, pos.y, eq.weapon, 1);
        eq.weapon = order.item;
      } else sim.world.add(id, EquipC, { weapon: order.item });
      sim.world.remove(id, EquipOrderC);
      sim.events.emit({ type: 'crew.equipped', crew: id, item: order.item });
    } else if (path.steps.length === 0 && pos.toX === pos.x && pos.toY === pos.y) {
      const m = sim.world.get(order.storage, ModuleC);
      const steps = m && findPath(sim, shipIdOf(sim, pos), origin(pos), { x: m.x, y: m.y, adjacent: true });
      if (steps) path.steps = steps;
      else cancel();
    }
  }
}

/** Unarmed crew whose role has a loadout go and fetch the first item of it that storage holds. */
export function autoLoadout(sim: Sim): void {
  for (const id of sim.world.query(CrewC, PositionC)) {
    if ((sim.tick + id) % 10 !== 0) continue;
    const loadout = sim.content.roles[sim.world.get(id, CrewC)?.role ?? '']?.loadout;
    if (!loadout || sim.world.get(id, EquipC)?.weapon || sim.world.has(id, EquipOrderC) || sim.world.has(id, DraftedC)) continue;
    if (sim.world.get(id, CrewC)?.activity === 'sleeping') continue;
    for (const item of loadout) if (orderEquip(sim, id, item) === null) break;
  }
}
