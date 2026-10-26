import type { World } from '../sim/ecs';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { airlockLayers, type AirlockView } from './airlockArt';
import { moduleLayers, type ModuleLayer, type ModuleLook } from './moduleArt';
import { robotBayLayers } from './robotBayArt';
import { vehicleBayLayers, type BayStep } from './vehicleBayArt';
import type { WallLevel } from './tiles';

/** What the layer builders need besides the module itself: the animation state the world view tracks, or a fixed preview state. */
export interface LayerState {
  active: boolean;
  now: number;
  livery?: { seed: number } | null;
  look?: ModuleLook;
  /** Airlocks: the wall view level, whether the ship is roofed, and the collar's dock-sequence step (null = follows the airlock). */
  airlock: AirlockView;
  /** Vehicle bays: the shuttle / pod state (`steady(true)` = parked in its claws, `steady(false)` = empty pit). */
  bay: BayStep;
}

/**
 * The sprite layers of a module, bottom first: the one place that picks the layer builder (robot bay, vehicle bay, docking
 * airlock, or the generic chain). The world view and the catalog thumbnails / placement ghost all draw from it.
 */
export function layersOf(world: World, id: number, m: Module, def: ModuleDef, s: LayerState): ModuleLayer[] {
  if (def.robotBay) return robotBayLayers(world, id, m, def, s.now);
  if (def.vehicleBay) return vehicleBayLayers(m, def, s.bay);
  if (def.airlock?.layout) return airlockLayers(world, id, m, def, s.airlock);
  return moduleLayers(world, id, m, def, s.active, true, s.livery, s.look);
}

export const PREVIEW_LEVEL: WallLevel = 'up';
