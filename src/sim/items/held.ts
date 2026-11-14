import { AllegianceC, EquipC } from '../fight/components';
import { ModuleC } from '../modules/components';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { playerShips, playerStorages, withPlayerAboard } from '../story/world';
import { AssignmentC, JobC } from '../crew/components';
import { releaseHold } from '../modules/hold';
import { CarryingC, ItemStackC, StorageC } from './components';
import { destroyJob } from './stacks';
import { storageTake } from './storage';
import { takeFromStack } from './stacks';
import { StasisWheelC } from '../stasis/components';
import { emptySlabsIn } from '../stasis/query';
import { takeEmptySlabs } from '../stasis/freeze';
import { SLAB_ITEM } from '../stasis/tuning';

/**
 * Where a held item is: cargo storage, a loose stack, a wielded weapon, a carried load, a module's fitted upgrade, an upgrade handed to a fit job,
 * or empty stasis slabs standing in a wheel's slots.
 */
export type HeldWhere = 'storage' | 'stack' | 'wielded' | 'carried' | 'fitted' | 'fitting' | 'slotted';

export interface Held {
  item: string;
  count: number;
  where: HeldWhere;
  /** The entity that holds it (storage module, stack, crew, module). */
  holder: number;
  /** Take these units out of where they are held (all of them when `n` is omitted). A fitted upgrade comes off the module and leaves it un-upgraded. */
  remove(n?: number): void;
}

export interface HeldOptions {
  /** Also list loose stacks claimed by a station job (delivery crates, `ItemStack.job`). Off by default: a crate is the station's cargo, not the player's stock. */
  reserved?: boolean;
}

/** The fit jobs (kind 'fit', fitting an upgrade) a crew member's load is on its way to: the haul's destination and later stops. */
function fitJobsFor(sim: Sim, crew: number): number[] {
  const a = sim.world.get(crew, AssignmentC);
  const h = a && sim.world.get(a.jobId, JobC)?.haul;
  if (!h) return [];
  const ids = [h.dst, ...(h.then ?? []).map((t) => ({ kind: 'job', id: t.job }))].filter((d) => d.kind === 'job').map((d) => d.id);
  return ids.filter((id) => sim.world.get(id, JobC)?.kind === 'fit');
}

/** Call off a fit job whose upgrade is gone: its crew member is released, the module's work hold ends and anything delivered is not spilled again. */
export function cancelFit(sim: Sim, jobId: number): void {
  const j = sim.world.get(jobId, JobC);
  if (!j) return;
  j.delivered = [];
  releaseHold(sim, j.target ?? 0);
  destroyJob(sim, jobId);
}

/**
 * Every item the player's ships hold, one entry per holding place: storage stacks, loose stacks on the ship, crew weapons and loads, and upgrades
 * fitted in modules. The one list scans and seizure read, so a new holding place is added here once. In hyperspace the packet's entities are put
 * back in the world for the call (`withPlayerAboard`), so it reads the same either way. Call `remove` inside `withHeld` so it reaches packet entities.
 */
export function heldItems(sim: Sim, opts: HeldOptions = {}): Held[] {
  return withPlayerAboard(sim, () => {
    const out: Held[] = [];
    const w = sim.world;
    const ships = playerShips(sim);
    for (const id of w.query(AllegianceC)) {
      if (w.get(id, AllegianceC)?.faction !== 'player') continue;
      const eq = w.get(id, EquipC);
      if (eq?.weapon) out.push({ item: eq.weapon, count: 1, where: 'wielded', holder: id, remove: () => void (eq.weapon = null) });
      const hauled = w.get(id, CarryingC);
      if (hauled) {
        // An upgrade on its way to a fit job: the job goes with it (the carrier is released by the cancel).
        const fits = fitJobsFor(sim, id).filter((f) => w.get(f, JobC)?.fit?.item === hauled.item);
        out.push({ item: hauled.item, count: hauled.count, where: 'carried', holder: id, remove: () => { w.remove(id, CarryingC); for (const f of fits) cancelFit(sim, f); } });
      }
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
      if (s && (opts.reserved || !s.job) && ships.has(shipIdAt(sim, s.x, s.y))) {
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
    for (const id of w.query(StasisWheelC, ModuleC)) {
      const n = emptySlabsIn(sim, id);
      if (n > 0 && ships.has(shipIdOf(sim, w.get(id, ModuleC)))) out.push({ item: SLAB_ITEM, count: n, where: 'slotted', holder: id, remove: (k) => void takeEmptySlabs(sim, id, k ?? n) });
    }
    for (const id of w.query(JobC)) {
      const j = w.get(id, JobC);
      if (j?.kind !== 'fit' || !ships.has(shipIdOf(sim, j))) continue;
      const item = j.fit?.item;
      const have = (j.delivered ?? []).find((q) => q.item === item);
      if (item && have && have.count > 0) out.push({ item, count: have.count, where: 'fitting', holder: id, remove: () => cancelFit(sim, id) });
    }
    return out;
  });
}

/** Run `fn` over the held list with the packet (if any) in the world, so `remove` reaches packet entities too. */
export const withHeld = <T>(sim: Sim, fn: (held: Held[]) => T, opts: HeldOptions = {}): T => withPlayerAboard(sim, () => fn(heldItems(sim, opts)));
