import type { World } from '../sim/ecs';
import { JobC, PositionC } from '../sim/crew/components';
import { isSettled } from '../sim/crew/helpers';
import { StorageC } from '../sim/items/components';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';

/** Storage reads 'full' from this share of its slots upward. */
const FULL_SHARE = 0.75;

/** Fill class of a storage module from its slots in use. */
export function storageFill(world: World, id: number): 'empty' | 'partial' | 'full' {
  const s = world.get(id, StorageC);
  if (!s || s.stacks.length === 0) return 'empty';
  return s.stacks.length >= s.capacity * FULL_SHARE ? 'full' : 'partial';
}

/** Craft jobs by module id, for the renderer's "is it crafting" test. */
export function craftProgress(world: World): Map<number, number> {
  const out = new Map<number, number>();
  for (const id of world.query(JobC)) {
    const j = world.get(id, JobC);
    if (j?.kind === 'craft' && j.target) out.set(j.target, j.progress);
  }
  return out;
}

/** Console modules whose operator is seated at the chair (an 'operate' job on it, its crew settled on the job tile). */
export function mannedConsoles(world: World): Set<number> {
  const out = new Set<number>();
  for (const jobId of world.query(JobC)) {
    const j = world.get(jobId, JobC);
    if (j?.kind !== 'operate' || !j.target || !j.reservedBy) continue;
    const p = world.get(j.reservedBy, PositionC);
    if (p && isSettled(p) && p.x === j.x && p.y === j.y) out.add(j.target);
  }
  return out;
}

/**
 * Asset ids to try for a module, most specific first: the rotation variant (`.r0`..`.r3`) with the state variant
 * (`.active`, or storage `.empty/.partial/.full`), the rotation variant, then the plain state variant and the plain
 * asset. A non-square module drawn from the plain asset at an odd rotation is mirrored (moduleView).
 */
export function moduleAssets(world: World, id: number, m: Module, def: ModuleDef, active: boolean): string[] {
  const state = def.storage ? `.${storageFill(world, id)}` : active ? '.active' : '';
  const rot = `.r${m.rot}`;
  return [`${def.asset}${rot}${state}`, `${def.asset}${rot}`, `${def.asset}${state}`, def.asset];
}

/** Which footprint tiles a stand-in sprite of a layer is repeated on (real art is one sprite per layer). */
export type LayerTiles = 'all' | 'hull' | 'rest';

/** One sprite layer of a module: tried in order, with `key` naming its stand-in. */
export interface ModuleLayer {
  chain: string[];
  key: string;
  tiles: LayerTiles;
  /** Depth offset over the module's key (a console's desk front draws over its seated operator). */
  dz?: number;
}

/** Depth offset of a seated operator over the console's key, and of the desk-front overlay over it. */
export const SEAT_DZ = 0.02;
export const FRONT_DZ = 0.03;

/** Targetable on enemy ships: weapons, engines, shield generators and the AI core (what the combat overlay can aim at). */
export const isTargetable = (def: ModuleDef): boolean => !!(def.weapon || def.engine || def.shieldGen || def.aiCore);

/** True when a module shows its `.active` art: engines and machines while powered, consoles while manned, fabricators while crafting. */
export function showsActive(def: ModuleDef, on: boolean, crafting: boolean, manned: boolean): boolean {
  if (!on) return false;
  if (def.console) return manned;
  if (def.crafting) return crafting;
  return !!(def.hullEdge || def.shieldGen || def.aiCore);
}

/**
 * The sprite layers of a module, bottom first.
 *  - Engines: `<asset>.hull.r{n}` (the always-full-height hull section) then `<asset>.machine.r{n}` (`.active` while burning).
 *  - Weapons: the floor bay `<asset>.bay.r{n}`; the turret above it is drawn by turretView.
 *  - Consoles: the usual chain, then the desk-front overlay `<asset>.front.r{n}[.active]` over the seated operator.
 *  - Everything else: the usual chain from `moduleAssets`.
 */
export function moduleLayers(world: World, id: number, m: Module, def: ModuleDef, active: boolean): ModuleLayer[] {
  const a = def.asset;
  const r = `.r${m.rot}`;
  if (def.hullEdge) {
    const burn = active ? ['.active'] : [];
    const machine = [...burn.map((b) => `${a}.machine${r}${b}`), `${a}.machine${r}`, ...burn.map((b) => `${a}.machine${b}`), `${a}.machine`];
    return [
      { chain: [`${a}.hull${r}`, `${a}.hull`], key: `${a}.hull`, tiles: 'hull' },
      { chain: machine, key: active ? `${a}.machine.active` : `${a}.machine`, tiles: 'rest' },
    ];
  }
  if (def.weapon || def.pointDefense) return [{ chain: [`${a}.bay${r}`, `${a}.bay`], key: `${a}.bay`, tiles: 'all' }];
  const main: ModuleLayer = { chain: moduleAssets(world, id, m, def, active), key: a, tiles: 'all' };
  if (!def.console) return [main];
  const front = active ? [`${a}.front${r}.active`, `${a}.front${r}`] : [`${a}.front${r}`];
  return [main, { chain: front, key: `${a}.front`, tiles: 'all', dz: FRONT_DZ }];
}
