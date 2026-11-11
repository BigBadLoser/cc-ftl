import { AssignmentC, CrewC, DraftedC, PathC, PositionC, type Position } from '../crew/components';
import { abortTask } from '../ai/task';
import { clearPath, isBreaking, isIncapacitated, origin } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import { spillItems } from '../items/stacks';
import { storageAdd, storageCount, storageTake } from '../items/storage';
import { StorageC } from '../items/components';
import { ModuleC } from '../modules/components';
import { footprintTiles } from '../modules/footprint';
import type { Sim } from '../sim';
import { AllegianceC, EquipC, EquipOrderC } from './components';
import { shipById } from '../combat/ships';
import { armsFor, isPlayerPerson } from './arms';
import { wontDo } from '../crew/wontDo';
import { stat } from '../stats';
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
export function atStorage(sim: Sim, pos: Position, storage: number): boolean {
  const m = sim.world.get(storage, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def || shipIdOf(sim, m) !== shipIdOf(sim, pos)) return false;
  return footprintTiles(def, m.x, m.y, m.rot).some((t) => Math.max(Math.abs(t.x - pos.x), Math.abs(t.y - pos.y)) <= 1);
}

/** Send a crew member to fetch `item` from storage. Returns a rejection reason, or null when the order is on. */
export function orderEquip(sim: Sim, crew: number, item: string): string | null {
  if (!sim.world.has(crew, CrewC)) return 'noCrew';
  if (!handDefOf(sim, item)) return 'notAWeapon';
  if (wontDo(sim, crew, 'violence')) return 'wontDo';
  const pos = sim.world.get(crew, PositionC);
  if (!pos || isIncapacitated(sim, crew)) return 'incapacitated';
  if (isBreaking(sim, crew)) return 'breaking'; // the break machine is the only path writer: no automatic or ordered fetch mid-break
  if (sim.world.get(crew, EquipC)?.weapon === item) return 'alreadyEquipped';
  const storage = nearestStock(sim, shipIdOf(sim, pos), origin(pos), item);
  if (!storage) return 'noStock';
  abortTask(sim, crew, 'equip');
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
    if (!order || !pos || !path || isBreaking(sim, id)) continue;
    const cancel = (): void => {
      sim.world.remove(id, EquipOrderC);
      clearPath(sim, id);
    };
    if (isIncapacitated(sim, id) || storageCount(sim, order.storage, order.item) <= 0) {
      cancel();
      continue;
    }
    // Only on arrival: a crew member passing a doorway diagonal to the crate must not take the weapon there and stop (#248).
    if (path.steps.length === 0 && atStorage(sim, pos, order.storage) && pos.toX === pos.x && pos.toY === pos.y) {
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

/** True while the crew member stands on a ship of their own side (not a station they visit, a wreck or a boarded ship). */
function onOwnShip(sim: Sim, id: number): boolean {
  return shipById(sim, shipIdOf(sim, sim.world.get(id, PositionC)))?.faction === sim.world.get(id, AllegianceC)?.faction;
}

/** Stock of `item` on the ship, less what crew already on their way to a locker will take. */
function freeStock(sim: Sim, shipId: number, item: string): number {
  let n = 0;
  for (const s of sim.world.query(StorageC, ModuleC)) {
    const m = sim.world.get(s, ModuleC);
    if (m && m.hp > 0 && shipIdOf(sim, m) === shipId) n += storageCount(sim, s, item);
  }
  for (const c of sim.world.query(EquipOrderC, PositionC)) {
    if (sim.world.get(c, EquipOrderC)?.item === item && shipIdOf(sim, sim.world.get(c, PositionC)) === shipId) n--;
  }
  return n;
}

/**
 * Crew go for the best weapon `armsFor` lists that storage holds and that beats what they carry (the old one goes back in the locker):
 * the unarmed (a robot or NPC kind's `loadout`, a person who lost theirs) and people of the player's crew with an upgrade waiting
 * (docs/TRAITS.md 10.9). One crew member per item, the unarmed and then the better fighters first: a better fighter who is busy still holds
 * their claim, so the rifle waits for the gunner. A person only goes when idle, out of combat, from their own ship's lockers. Never the
 * sleeping, drafted, downed or breaking.
 */
export function autoLoadout(sim: Sim): void {
  if (sim.tick % 10 !== 0) return;
  const want: { id: number; ship: number; arms: readonly string[]; rank: number; skill: number; go: boolean }[] = [];
  for (const id of sim.world.query(CrewC, PositionC)) {
    const arms = armsFor(sim, id);
    if (!arms.length || sim.world.has(id, EquipOrderC) || isIncapacitated(sim, id)) continue;
    const held = sim.world.get(id, EquipC)?.weapon;
    const rank = held ? arms.indexOf(held) : arms.length + 1;
    if (rank === 0 || (held && rank < 0)) continue; // the best already, or something the list doesn't rank (an ion pistol): keep it
    const person = isPlayerPerson(sim, id);
    if (held && !person) continue; // a kind's loadout only arms the unarmed
    if (person && !onOwnShip(sim, id)) continue; // from their own ship's lockers only
    const free = !sim.world.has(id, DraftedC) && !isBreaking(sim, id) && sim.world.get(id, CrewC)?.activity !== 'sleeping';
    const idle = !person || (!sim.world.has(id, AssignmentC) && sim.world.get(id, CrewC)?.activity === 'idle' && (!held || !sim.sector.inCombat));
    want.push({ id, ship: shipIdOf(sim, sim.world.get(id, PositionC)), arms, rank, skill: Math.max(stat(sim, id, 'gunnery'), stat(sim, id, 'melee')), go: free && idle });
  }
  want.sort((a, b) => Number(b.rank > b.arms.length) - Number(a.rank > a.arms.length) || b.skill - a.skill || a.id - b.id); // the unarmed first
  const left = new Map<string, number>();
  for (const w of want) {
    for (let i = 0; i < Math.min(w.rank, w.arms.length); i++) {
      const item = w.arms[i] as string;
      const key = `${w.ship}|${item}`;
      const n = left.get(key) ?? freeStock(sim, w.ship, item);
      if (n <= 0) continue;
      left.set(key, n - 1); // claimed, whether they go now or later
      if (w.go) orderEquip(sim, w.id, item);
      break;
    }
  }
}
