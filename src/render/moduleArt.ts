import type { World } from '../sim/ecs';
import { JobC } from '../sim/crew/components';
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

/**
 * Asset ids to try for a module, most specific first: the rotation variant of a non-square footprint
 * (`.r1`..`.r3`), the state variant (`.active`, or storage `.empty/.partial/.full`), then the plain asset.
 * `flip` is true only when the chosen rotation has no sprite of its own and a quarter turn is drawn mirrored.
 */
export function moduleAssets(world: World, id: number, m: Module, def: ModuleDef, crafting: boolean): string[] {
  const nonSquare = def.footprint[0] !== def.footprint[1];
  const state = def.storage ? `.${storageFill(world, id)}` : def.crafting && crafting ? '.active' : '';
  const rot = nonSquare && m.rot > 0 ? `.r${m.rot}` : '';
  const out = [`${def.asset}${rot}${state}`];
  if (rot) out.push(`${def.asset}${rot}`);
  out.push(`${def.asset}${state}`, def.asset);
  return out;
}
