import { AllegianceC, EquipC } from '../fight/components';
import { ModuleC } from '../modules/components';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { playerShips, playerStorages, withPlayerAboard } from '../story/world';
import { CarryingC, ItemStackC, StorageC } from './components';
import { storageTake } from './storage';
import { takeFromStack } from './stacks';

/** Where a held item is: cargo storage, a loose stack, a wielded weapon, a carried load or a module's fitted upgrade. */
export type HeldWhere = 'storage' | 'stack' | 'wielded' | 'carried' | 'fitted';

export interface Held {
  item: string;
  count: number;
  where: HeldWhere;
  /** The entity that holds it (storage module, stack, crew, module). */
  holder: number;
  /** Take these units out of where they are held (all of them when `n` is omitted). A fitted upgrade comes off the module and leaves it un-upgraded. */
  remove(n?: number): void;
}

/**
 * Every item the player's ships hold, one entry per holding place: storage stacks, loose stacks on the ship, crew weapons and loads, and upgrades
 * fitted in modules. The one list scans and seizure read, so a new holding place is added here once. In hyperspace the packet's entities are put
 * back in the world for the call (`withPlayerAboard`), so it reads the same either way. Call `remove` inside `withHeld` so it reaches packet entities.
 */
export function heldItems(sim: Sim): Held[] {
  return withPlayerAboard(sim, () => {
    const out: Held[] = [];
    const w = sim.world;
    const ships = playerShips(sim);
    for (const id of w.query(AllegianceC)) {
      if (w.get(id, AllegianceC)?.faction !== 'player') continue;
      const eq = w.get(id, EquipC);
      if (eq?.weapon) out.push({ item: eq.weapon, count: 1, where: 'wielded', holder: id, remove: () => void (eq.weapon = null) });
      const hauled = w.get(id, CarryingC);
      if (hauled) out.push({ item: hauled.item, count: hauled.count, where: 'carried', holder: id, remove: () => void w.remove(id, CarryingC) });
    }
    for (const id of playerStorages(sim)) {
      for (const st of w.get(id, StorageC)?.stacks ?? []) {
        // storageTake draws from any stack of the item in this module, not this one: take this entry's count as listed, never the live stack's.
        const { item, count } = st;
        out.push({ item, count, where: 'storage', holder: id, remove: (n) => void storageTake(sim, id, item, n ?? count) });
      }
    }
    for (const id of w.query(ItemStackC)) {
      const s = w.get(id, ItemStackC);
      if (s && !s.job && ships.has(shipIdAt(sim, s.x, s.y))) {
        const count = s.count;
        out.push({ item: s.item, count, where: 'stack', holder: id, remove: (n) => void takeFromStack(sim, id, n ?? count) });
      }
    }
    for (const id of w.query(ModuleC)) {
      const m = w.get(id, ModuleC);
      if (!m?.upgrade || !ships.has(shipIdOf(sim, m))) continue;
      out.push({
        item: m.upgrade, count: 1, where: 'fitted', holder: id,
        remove: () => {
          delete m.upgrade;
          sim.events.emit({ type: 'module.upgradeFitted', moduleId: id, item: null, ship: shipIdOf(sim, m) });
        },
      });
    }
    return out;
  });
}

/** Run `fn` over the held list with the packet (if any) in the world, so `remove` reaches packet entities too. */
export const withHeld = <T>(sim: Sim, fn: (held: Held[]) => T): T => withPlayerAboard(sim, () => fn(heldItems(sim)));
