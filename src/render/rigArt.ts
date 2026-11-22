import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { JobC } from '../sim/crew/components';
import { ModuleC, type Module } from '../sim/modules/components';
import { footprintTiles } from '../sim/modules/footprint';
import { bedOfRig } from '../sim/modules/rig';
import type { ModuleDef } from '../sim/registry';
import { FRONT_DZ, type ModuleLayer } from './moduleArt';

/**
 * A surgical rig's layers (#311): the body `<asset>[.r{n}].{idle,active}` (a stand-in from render/assets/fallback.ts until its sheets land) and the front
 * overlay `<asset>.front[.r{n}].{idle,active}` (the arms and lamp that reach over the bed), drawn at the rig but sorted at the front-most tile of the bed it
 * faces, over the bed and its patient (`sortAt`). `.active` while an operation is in progress at that bed. A missing overlay draws nothing.
 */
export interface RigView {
  /** The front-most tile of the bed the rig faces, in the module's frame; null when no bed (the rig serves nothing). */
  bedFront: { x: number; y: number } | null;
  /** An operation is in progress at that bed. */
  active: boolean;
}

export function rigLayers(m: Module, def: ModuleDef, rig: RigView | undefined): ModuleLayer[] {
  const a = def.asset;
  const r = `.r${m.rot}`;
  const s = rig?.active ? '.active' : '.idle';
  const body: ModuleLayer = { chain: [`${a}${r}${s}`, `${a}${r}`, `${a}${s}`, a], key: a, tiles: 'all' };
  if (!rig?.bedFront) return [body];
  const front = [`${a}.front${r}${s}`, `${a}.front${r}`, `${a}.front${s}`, `${a}.front`];
  return [body, { chain: front, key: `${a}.front`, tiles: 'all', dz: FRONT_DZ, sortAt: rig.bedFront, optional: true }];
}

/** What rig `id`'s art reads from the world, with the bed's front tile region-local (minus the grid origin, as the module's own tile is). */
export function rigView(world: World, defs: Readonly<Record<string, ModuleDef>>, grid: Grid, id: number): RigView {
  const bed = bedOfRig(world, defs, grid, id);
  const b = world.get(bed, ModuleC);
  const def = b && defs[b.def];
  if (!b || !def) return { bedFront: null, active: false };
  const t = footprintTiles(def, b.x, b.y, b.rot).reduce((a, c) => (c.x + c.y > a.x + a.y ? c : a), { x: b.x, y: b.y });
  let active = false;
  for (const j of world.query(JobC)) {
    const job = world.get(j, JobC);
    if (job?.kind === 'surgery' && job.bed === bed && job.progress > 0) active = true;
  }
  return { bedFront: { x: t.x - grid.x0, y: t.y - grid.y0 }, active };
}

/** The rig's view as a memo input (render/moduleMemo.ts `sameInputs`). */
export const rigInputs = (v: RigView | undefined): string => (v ? `|${v.bedFront ? `${v.bedFront.x},${v.bedFront.y}` : '-'}|${v.active ? 1 : 0}` : '');
