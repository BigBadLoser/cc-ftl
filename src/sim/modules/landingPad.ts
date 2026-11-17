import type { World } from '../ecs';
import type { ModuleDef } from '../registry';
import { AirlockC, airlockTiles } from './airlock';
import { ModuleC } from './components';
import { footprintTiles, rotatedSize } from './footprint';
import { groundPort } from './groundMount';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { VehicleBayC } from '../vehicles/components';

/**
 * Landing pads (#509): the 9x9 patches of levelled ground a surface (prefab) base keeps its shuttle on, in place of a hangar bay, and
 * where visiting shuttles land. A pad is a vehicle bay with no pit (`ModuleDef.vehicleBay.pad`): the owning functions of vehicles
 * (`bayCenter`, `bayWorking`, `boardingTile`) read it like any bay. This file owns "is this a pad" and "which pad belongs to this airlock".
 */

/** The landing pad's def id. */
export const LANDING_PAD = 'module.landing_pad';

/** Whether a def is a landing pad (build menus, render and placement ask here). */
export function isLandingPad(def: Pick<ModuleDef, 'vehicleBay'> | undefined): boolean {
  return !!def?.vehicleBay?.pad;
}

/** How far (tiles) an airlock's outer door may be from a pad's footprint for the pad to be that airlock's (the apron the generator keeps: collar and one more). */
const NEAR = 4;

/**
 * The pad an airlock opens onto (the nearest pad of its ship within NEAR tiles of its outer door), or 0 when it has none: a base of
 * hangars (no pads), or a crew airlock (the wing's, a greenhouse's) with no pad beside it. Reads the world only, so the render asks too.
 */
export function padOfAirlock(world: World, modules: Readonly<Record<string, ModuleDef>>, shipOf: (m: { x: number; y: number }) => number, airlock: number): number {
  const am = world.get(airlock, ModuleC);
  const adef = am && modules[am.def];
  if (!am || !adef?.airlock || !world.has(airlock, AirlockC)) return 0;
  const o = airlockTiles(adef, am).outer;
  let best = 0, bestD = Infinity;
  for (const id of world.query(VehicleBayC, ModuleC)) {
    const m = world.get(id, ModuleC), def = m && modules[m.def];
    if (!m || !isLandingPad(def) || shipOf(m) !== shipOf(am)) continue;
    let d = Infinity;
    for (const t of footprintTiles(def as ModuleDef, m.x, m.y, m.rot)) d = Math.min(d, Math.abs(t.x - o.x) + Math.abs(t.y - o.y));
    if (d <= NEAR && (d < bestD || (d === bestD && id < best))) [best, bestD] = [id, d];
  }
  return best;
}

/** `padOfAirlock` for the sim. */
export function airlockPad(sim: Sim, airlock: number): number {
  return padOfAirlock(sim.world, sim.content.modules, (m) => shipIdOf(sim, m), airlock);
}

/**
 * The airlock a pad opens onto (the nearest one whose pad it is), or 0: where crew walk between the pad and the base.
 */
export function padAirlock(sim: Sim, pad: number): number {
  let best = 0, bestD = Infinity;
  const pm = sim.world.get(pad, ModuleC);
  const pdef = pm && sim.content.modules[pm.def];
  if (!pm || !isLandingPad(pdef)) return 0;
  for (const id of sim.world.query(AirlockC)) {
    if (airlockPad(sim, id) !== pad) continue;
    const am = sim.world.get(id, ModuleC), adef = am && sim.content.modules[am.def];
    if (!am || !adef?.airlock) continue;
    const o = airlockTiles(adef, am).outer;
    const d = Math.abs(o.x - (pm.x + 4)) + Math.abs(o.y - (pm.y + 4));
    if (d < bestD || (d === bestD && id < best)) [best, bestD] = [id, d];
  }
  return best;
}

/**
 * Where crew board and leave a pad (#509): the edge tile of its footprint nearest its airlock's outer door, clear of the cable port.
 * Null when it is no pad.
 */
export function padBoardTile(sim: Sim, pad: number): { x: number; y: number } | null {
  const pm = sim.world.get(pad, ModuleC);
  const def = pm && sim.content.modules[pm.def];
  if (!pm || !def || !isLandingPad(def)) return null;
  const am = sim.world.get(padAirlock(sim, pad), ModuleC), adef = am && sim.content.modules[am.def];
  const to = am && adef?.airlock ? airlockTiles(adef, am).outer : { x: pm.x + 4, y: pm.y + 4 };
  const [w, h] = rotatedSize(def, pm.rot);
  const port = groundPort(def, pm).side;
  let best: { x: number; y: number } | null = null, bestD = Infinity;
  for (const t of footprintTiles(def, pm.x, pm.y, pm.rot)) {
    if (t.x > pm.x && t.y > pm.y && t.x < pm.x + w - 1 && t.y < pm.y + h - 1) continue; // an edge tile
    if (Math.abs(t.x - port.x) + Math.abs(t.y - port.y) <= 1) continue;
    const d = Math.abs(t.x - to.x) + Math.abs(t.y - to.y);
    if (d < bestD) [best, bestD] = [{ x: t.x, y: t.y }, d];
  }
  return best;
}
