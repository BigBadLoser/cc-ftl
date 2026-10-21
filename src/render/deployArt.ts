import { ART_SCALE } from './iso';
import type { World } from '../sim/ecs';
import { DeployC } from '../sim/modules/components';

/** Number of pre-rendered deploy frames between stowed and fully out. */
export const DEPLOY_FRAMES = 5;
/** Stand-in only: how far (art px) a partly deployed placeholder sinks below its deployed position. */
export const RISE_PX = 22 * ART_SCALE;

/** Deploy stage of a roof part: -1 stowed, 0..DEPLOY_FRAMES-1 a deploy frame, DEPLOY_FRAMES fully out. */
export function deployStage(world: World, moduleId: number): number {
  const a = world.get(moduleId, DeployC)?.amount ?? 0;
  if (a <= 0) return -1;
  if (a >= 1) return DEPLOY_FRAMES;
  return Math.min(DEPLOY_FRAMES - 1, Math.floor(a * DEPLOY_FRAMES));
}

/** Asset id of a stage short of fully out: `<base>.stowed` or `<base>.deploy.f<i>`. */
export const deployId = (base: string, stage: number): string => (stage < 0 ? `${base}.stowed` : `${base}.deploy.f${stage}`);
