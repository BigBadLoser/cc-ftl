import type { World } from '../sim/ecs';
import { JobC, PositionC } from '../sim/crew/components';
import { isSettled } from '../sim/crew/helpers';
import { StorageC } from '../sim/items/components';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { depthKey } from './iso';
import { hullOutward, hullRow, hullSide } from '../sim/modules/footprint';

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
  /** Lies outside the hull (an engine bell): sorts by the tile just beyond the hull row's front tile. */
  out?: boolean;
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
 *  - Engines: `<asset>.hull.r{n}` (the bulkhead, never cut; the hull wall around it is the game's hull tile), the
 *    machine `<asset>.machine.r{n}` (cut by the wall; `.machine.open.r{n}` when the walls are down, `open`), and the
 *    bell outside the hull `<asset>.bell.r{n}`, sorted by its own tile (`out`); `.active` while burning.
 *  - Weapons: the floor bay `<asset>.bay.r{n}`; the turret above it is drawn by turretView.
 *  - Consoles: the usual chain, then the desk-front overlay `<asset>.front.r{n}[.active]` over the seated operator.
 *  - Everything else: the usual chain from `moduleAssets`.
 */
export function moduleLayers(world: World, id: number, m: Module, def: ModuleDef, active: boolean, open = false): ModuleLayer[] {
  const a = def.asset;
  const r = `.r${m.rot}`;
  if (def.hullEdge) {
    const burn = active ? ['.active'] : [];
    const variant = (part: string) => [...burn.map((b) => `${a}.${part}${r}${b}`), `${a}.${part}${r}`];
    const machine = [...(open ? variant('machine.open') : []), ...variant('machine'), ...burn.map((b) => `${a}.machine${b}`), `${a}.machine`];
    return [
      { chain: [`${a}.hull${r}`, `${a}.hull`], key: `${a}.hull`, tiles: 'hull' },
      { chain: machine, key: active ? `${a}.machine.active` : `${a}.machine`, tiles: 'rest' },
      { chain: variant('bell'), key: `${a}.bell`, tiles: 'rest', out: true },
    ];
  }
  if (def.weapon || def.pointDefense) return [{ chain: [`${a}.bay${r}`, `${a}.bay`], key: `${a}.bay`, tiles: 'all' }];
  const main: ModuleLayer = { chain: moduleAssets(world, id, m, def, active), key: a, tiles: 'all' };
  if (!def.console) return [main];
  const front = active ? [`${a}.front${r}.active`, `${a}.front${r}`] : [`${a}.front${r}`];
  return [main, { chain: front, key: `${a}.front`, tiles: 'all', dz: FRONT_DZ }];
}

/**
 * Depth key of layer `i` of a module drawn on a tile whose own module key is `key`. An engine's bell sorts by the tile
 * beyond its hull row (`out`). On a roofed ship the engine's other layers (bulkhead and machine) sort under the roof plates of its footprint
 * (just before its rear-most tile's plate), so the roof hides everything inboard and only the bulkhead top and the bell
 * show, like the hull around it. Drawn at its front tile they would paint over the roof.
 */
export function layerKey(def: ModuleDef, m: Module, layer: ModuleLayer, i: number, roofed: boolean, key: number): number {
  if (layer.out) {
    // The bell hangs outside the hull toward space: it draws over the hull behind it and under anything nearer.
    const row = hullRow(def, m.x, m.y, m.rot);
    const side = hullSide(def, m.rot);
    const front = row.reduce((p, t) => (t.x + t.y > p.x + p.y ? t : p), row[0] ?? { x: m.x, y: m.y });
    const o = side ? hullOutward(side) : { x: 0, y: 0 };
    return depthKey(front.x + o.x, front.y + o.y) + 0.5;
  }
  if (roofed && def.hullEdge) return depthKey(m.x, m.y) + 0.85 + i * 0.001;
  return key + (layer.dz ?? i * 0.001);
}
