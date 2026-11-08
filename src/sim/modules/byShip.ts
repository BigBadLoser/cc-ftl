import { ShipC } from '../combat/components';
import type { ModuleDef } from '../registry';
import { shipIdOf } from '../regions';
import type { SectorGrid } from '../sectorGrid';
import type { Sim } from '../sim';
import { ModuleC, type Module } from './components';

/** A pure test of a module def (content), used as a cache key: pass a module-level constant, never a fresh closure. */
export type DefTest = (def: ModuleDef) => boolean;

/** The modules whose def passes a test, ascending ids, each with the ship it stands on (`shipIdOf`). */
export interface ModuleList {
  readonly ids: readonly number[];
  readonly ships: readonly number[];
  /** The same ids grouped by ship, each list ascending. */
  readonly byShip: ReadonlyMap<number, readonly number[]>;
}

/**
 * Which ship every module stands on, derived from what `shipIdOf` reads: the module's tile, the sector `ship` owner layer,
 * the ShipC set and every ship's rectangle. Rebuilt whenever any of them changes (module set or position, a ship added,
 * removed, moved or grown, an owner tile written), so every answer equals a fresh `shipIdOf`. A cache, never saved: a loaded
 * sim starts cold.
 */
interface Index {
  mods: readonly number[];
  content: Sim['content'];
  grid: SectorGrid;
  ownerRev: number;
  shipSet: readonly number[];
  rects: number[];
  /** Tick of the last check of every module's position and def. */
  checked: number;
  objs: Module[];
  xs: Float64Array;
  ys: Float64Array;
  defs: string[];
  /** Ship of each module, aligned with `mods`. */
  shipOf: Float64Array;
  lists: Map<DefTest | null, ModuleList>;
}

const indexes = new WeakMap<Sim, Index>();

function shipRects(sim: Sim, ships: readonly number[]): number[] {
  const out: number[] = [];
  for (const id of ships) {
    const s = sim.world.get(id, ShipC);
    if (s) out.push(s.x, s.y, s.width, s.height);
    else out.push(NaN, NaN, NaN, NaN);
  }
  return out;
}

function sameRects(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function fresh(sim: Sim, idx: Index): boolean {
  if (idx.mods !== sim.world.query(ModuleC) || idx.content !== sim.content || idx.grid !== sim.sector.grid) return false;
  if (idx.ownerRev !== sim.sector.grid.revision('ship') || idx.shipSet !== sim.world.query(ShipC)) return false;
  if (!sameRects(idx.rects, shipRects(sim, idx.shipSet))) return false;
  if (idx.checked !== sim.tick) {
    // Module components are created once and never moved in place (a lift detaches and restores them, which changes the
    // set); checked once a tick all the same, so an in-place move can never leave a stale ship.
    for (let k = 0; k < idx.mods.length; k++) {
      const m = idx.objs[k] as Module;
      if (m !== sim.world.get(idx.mods[k] as number, ModuleC) || m.x !== idx.xs[k] || m.y !== idx.ys[k] || m.def !== idx.defs[k]) return false;
    }
    idx.checked = sim.tick;
  }
  return true;
}

function build(sim: Sim): Index {
  const mods = sim.world.query(ModuleC);
  const shipSet = sim.world.query(ShipC);
  const n = mods.length;
  const idx: Index = {
    mods, content: sim.content, grid: sim.sector.grid, ownerRev: sim.sector.grid.revision('ship'), shipSet, rects: shipRects(sim, shipSet),
    checked: sim.tick, objs: [], xs: new Float64Array(n), ys: new Float64Array(n), defs: [], shipOf: new Float64Array(n), lists: new Map(),
  };
  for (let k = 0; k < n; k++) {
    const m = sim.world.get(mods[k] as number, ModuleC) as Module;
    idx.objs.push(m);
    idx.xs[k] = m.x;
    idx.ys[k] = m.y;
    idx.defs.push(m.def);
    idx.shipOf[k] = shipIdOf(sim, m);
  }
  return idx;
}

function current(sim: Sim): Index {
  const hit = indexes.get(sim);
  if (hit && fresh(sim, hit)) return hit;
  const idx = build(sim);
  indexes.set(sim, idx);
  return idx;
}

/**
 * The modules whose def passes `test` (every module with a def for `null`), ascending ids, with their ships. Iterating it
 * visits exactly the modules a scan of `query(ModuleC)` filtered by the test (and by `shipIdOf` for one ship) would, in the
 * same order. Read-only.
 */
export function modulesWhere(sim: Sim, test: DefTest | null): ModuleList {
  const idx = current(sim);
  let list = idx.lists.get(test);
  if (list) return list;
  const ids: number[] = [], ships: number[] = [];
  const byShip = new Map<number, number[]>();
  for (let k = 0; k < idx.mods.length; k++) {
    const def = sim.content.modules[idx.defs[k] as string];
    if (!def || (test && !test(def))) continue;
    const id = idx.mods[k] as number, ship = idx.shipOf[k] as number;
    ids.push(id);
    ships.push(ship);
    const on = byShip.get(ship);
    if (on) on.push(id);
    else byShip.set(ship, [id]);
  }
  list = { ids, ships, byShip };
  idx.lists.set(test, list);
  return list;
}

const NONE: readonly number[] = [];

/** The modules on ship `ship` whose def passes `test` (any def for `null`), ascending ids. Read-only. */
export function modulesOn(sim: Sim, ship: number, test: DefTest | null): readonly number[] {
  return modulesWhere(sim, test).byShip.get(ship) ?? NONE;
}

/** The ship every module stands on, by module id (only modules whose def exists), in `shipIdOf`'s terms. */
export function moduleShip(sim: Sim, id: number): number {
  const all = modulesWhere(sim, null);
  // Binary search: ids ascend.
  let lo = 0, hi = all.ids.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = all.ids[mid] as number;
    if (v === id) return all.ships[mid] as number;
    if (v < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return 0;
}
