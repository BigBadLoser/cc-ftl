import type { Grid, GridLike } from '../grid';
import type { Sim } from '../sim';
import { DoorJam, isEvaWalkable, isWalkable } from '../structure';
import { AirlockC, airlockTiles, airlockWorking, openSide } from './airlock';
import { ModuleC } from './components';
import { openTilesOf } from './footprint';

/** True if the module entity is a solid one (blocks walking). Unknown ids are not solid. */
export function isSolidModule(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return m ? (sim.content.modules[m.def]?.solid ?? false) : false;
}

/**
 * Walk info of a module: solid, the world tiles (keyed y * OPEN_KEY + x) of it that stay walkable, and its doors that cannot open now
 * (`shut`: an airlock that does not work, enabled, intact and powered, never cycles, so the door it does not have open is a wall, #292).
 */
export interface WalkInfo {
  solid: boolean;
  open: Set<number>;
  shut: Set<number>;
}
export const OPEN_KEY = 4096;

export function walkInfo(sim: Sim, id: number): WalkInfo {
  const m = sim.world.get(id, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def) return { solid: false, open: new Set(), shut: new Set() };
  const shut = new Set<number>();
  const a = def.airlock && sim.world.get(id, AirlockC);
  if (a && !airlockWorking(sim, id)) {
    const t = airlockTiles(def, m);
    const side = openSide(a);
    if (side !== 'outer') shut.add(t.outer.y * OPEN_KEY + t.outer.x);
    if (side !== 'inner') shut.add(t.inner.y * OPEN_KEY + t.inner.x);
  }
  return { solid: def.solid, open: new Set(openTilesOf(def, m.x, m.y, m.rot).map((t) => t.y * OPEN_KEY + t.x)), shut };
}

/**
 * The one walk rule (docs/ARCHITECTURE.md "Away sites", #292): a walker may step on (x, y) if its struct is walkable (or, `suited`, the
 * grid's exterior surface: suited and airless crew), it is not a door that cannot open now (jammed shut, or the shut door of an airlock that
 * does not work), and no solid module stands there. `findPath`, the scheduler's navigation views and movement all ask this, so pathing,
 * reach, job feasibility and the step itself agree. `infos` caches module walk info for the length of one search.
 */
export function passAt(sim: Sim, grid: GridLike, x: number, y: number, kind: number, jam: number | undefined, mod: number | undefined, infos: Map<number, WalkInfo>, suited: boolean): boolean {
  if (!isWalkable(kind) && !(suited && isEvaWalkable(grid, x, y))) return false;
  if (jam === DoorJam.Shut) return false;
  if (!mod) return true;
  let info = infos.get(mod);
  if (!info) infos.set(mod, (info = walkInfo(sim, mod)));
  const k = y * OPEN_KEY + x;
  return !info.shut.has(k) && (!info.solid || info.open.has(k));
}

/**
 * What the walk rule reads beyond the grid's fields: which airlocks on the window cannot cycle and which side they stand open on. Part of
 * `walkSignature`, so a cached search or view goes stale when an airlock loses or regains power.
 */
export function doorSignature(sim: Sim, grid: GridLike): string {
  let sig = '';
  for (const id of sim.world.query(AirlockC, ModuleC)) {
    const m = sim.world.get(id, ModuleC)!;
    if (!grid.inBounds(m.x, m.y) || airlockWorking(sim, id)) continue;
    sig += `${id}:${openSide(sim.world.get(id, AirlockC)!) ?? '-'},`;
  }
  return sig;
}

/** Crew can stand here (`passAt` for one tile). `suited`: the walker walks outside (suited or airless). */
export function isTileWalkable(sim: Sim, grid: Grid, x: number, y: number, suited = false): boolean {
  if (!grid.inBounds(x, y)) return false;
  const jam = grid.has('jam') ? grid.get('jam', x, y) : undefined;
  const mod = grid.has('module') ? grid.get('module', x, y) : undefined;
  return passAt(sim, grid, x, y, grid.get('struct', x, y), jam, mod, new Map(), suited);
}
