import type { World } from '../sim/ecs';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { ANIM_FPS, FRONT_DZ, animFrame, frameCount, moduleLayers, type ModuleLayer, type ModuleLook } from './moduleArt';

/**
 * The recovery pod's layers (#319; sprite ids in docs/RENDER_LAB.md `recovery`). Bottom up, over the pod's depth key K: the pod (bubble loop while powered,
 * `.unpowered` dark), the scanner's far half K+0.01, the patient K+0.02 (crewView: a crew member in the pod is the module's seated figure), the front
 * overlay K+0.03 (the fluid's near film, glass, near bubbles and the hat, on the same bubble frame) and the scanner's near half K+0.04.
 * The scanner sweeps (16 frames, foot to head and back) every `SCAN_PERIOD_MS` while powered, each pod on its own offset.
 */

/** The two layers over the patient: their glow paints over the patient too (`glowKey`), not under the seated figure as a console desk front's does. */
const GLOW_OVER = { glowOver: true as const };

export const SCAN_FRAMES = 16;
export const SCAN_PERIOD_MS = 30000;

/** The scan frame to show at `now` for pod `id`, or -1 between sweeps. The offset is whole animation frames, so the art clock's steps cover it. */
export function scanFrame(now: number, id: number): number {
  const frameMs = 1000 / ANIM_FPS;
  const offset = ((id * 37) % (SCAN_PERIOD_MS / frameMs)) * frameMs;
  const f = Math.floor(((Math.max(0, now) + offset) % SCAN_PERIOD_MS) / frameMs);
  return f < SCAN_FRAMES ? f : -1;
}

const at = (base: string, f: number): string => (f ? `${base}.f${f}` : base);

export function recoveryLayers(world: World, id: number, m: Module, def: ModuleDef, active: boolean, look?: ModuleLook): ModuleLayer[] {
  const main = moduleLayers(world, id, m, def, active, true, null, look)[0] as ModuleLayer;
  if (!look || look.hp === undefined || look.hp <= 0) return [main];
  const a = def.asset;
  const r = `.r${m.rot}`;
  if (look.off) return [main, { chain: [`${a}.front${r}.unpowered`, `${a}.front${r}`], key: `${a}.front`, tiles: 'all', dz: FRONT_DZ, optional: true, ...GLOW_OVER }];
  const out: ModuleLayer[] = [main];
  const scan = active ? scanFrame(look.now, id) : -1;
  if (scan >= 0) out.push({ chain: [at(`${a}.scan.back${r}`, scan)], key: `${a}.scan.back`, tiles: 'all', dz: 0.01, optional: true, anim: `${a}.scan.back${r}` });
  const base = `${a}.front${r}.active`;
  const n = active ? frameCount(look.has, base) : 0;
  out.push({
    chain: n > 1 ? [at(base, animFrame(look.now, n)), `${a}.front${r}`] : [`${a}.front${r}`], key: `${a}.front`, tiles: 'all', dz: FRONT_DZ, optional: true,
    ...(n > 1 ? { anim: base } : {}), ...GLOW_OVER,
  });
  if (scan >= 0) out.push({ chain: [at(`${a}.scan.front${r}`, scan)], key: `${a}.scan.front`, tiles: 'all', dz: 0.04, optional: true, ...GLOW_OVER, anim: `${a}.scan.front${r}` });
  return out;
}
