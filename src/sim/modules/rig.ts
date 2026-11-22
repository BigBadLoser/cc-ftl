import type { World } from '../ecs';
import type { ModuleDef } from '../registry';
import type { Grid } from '../grid';
import { ModuleC, type Module } from './components';
import { rotateOffset, type Tile } from './footprint';

/**
 * A surgical rig (`ModuleDef.rig`, #311): a 1x1 machine standing beside a bed of `rig.bed` and facing its foot tile, from either long side (not the
 * head, where the bed's monitor tower stands). The bed it faces is surgery-grade while the rig is powered (crew/surgery.ts `surgeryGrade`). Here: the
 * geometry, the placement rule (modules/spawn.ts `placementError`) and which rig faces a bed. World reads only, so render asks the same questions.
 */

const add = (a: Tile, b: Tile): Tile => ({ x: a.x + b.x, y: a.y + b.y });

/** The tile a 1x1 module at (x, y) faces: local +y, turned with its rotation. */
export const rigFront = (def: ModuleDef, x: number, y: number, rot: number): Tile => add({ x, y }, rotateOffset(def, rot, 0, 1));

/** A bed's head and foot tiles: local (0, 0) is the head (the pillow and monitor end, as the art draws it), the far end of its long axis the foot. */
export function bedEnds(def: ModuleDef, x: number, y: number, rot: number): { head: Tile; foot: Tile } {
  return { head: add({ x, y }, rotateOffset(def, rot, 0, 0)), foot: add({ x, y }, rotateOffset(def, rot, 0, def.footprint[1] - 1)) };
}

/** Does a rig at (x, y, rot) face the foot of a bed at (bx, by, brot) from a long side? */
export function rigFitsBed(rigDef: ModuleDef, x: number, y: number, rot: number, bedDef: ModuleDef, bx: number, by: number, brot: number): boolean {
  const front = rigFront(rigDef, x, y, rot);
  const { head, foot } = bedEnds(bedDef, bx, by, brot);
  if (front.x !== foot.x || front.y !== foot.y) return false;
  const along = { x: Math.sign(foot.x - head.x), y: Math.sign(foot.y - head.y) };
  const side = { x: x - foot.x, y: y - foot.y };
  return Math.abs(side.x) + Math.abs(side.y) === 1 && side.x * along.x + side.y * along.y === 0;
}

/** Why a rig cannot stand at (x, y, rot): no bed of its kind (built, or a blueprint in `planned`) has its foot in front of it, reached from a long side. Null when one does. */
export function rigPlacementError(
  world: World, modules: Readonly<Record<string, ModuleDef>>, grid: Grid, def: ModuleDef, x: number, y: number, rot: number,
  planned: readonly { def: string; x: number; y: number; rot: number }[],
): string | null {
  if (!def.rig) return null;
  const front = rigFront(def, x, y, rot);
  const bedDef = modules[def.rig.bed];
  if (!bedDef || !grid.inBounds(front.x, front.y)) return 'rigNeedsBedFoot';
  const built = world.get(grid.get('module', front.x, front.y), ModuleC);
  const beds = [...(built?.def === def.rig.bed ? [built] : []), ...planned.filter((p) => p.def === def.rig?.bed)];
  return beds.some((b) => rigFitsBed(def, x, y, rot, bedDef, b.x, b.y, b.rot)) ? null : 'rigNeedsBedFoot';
}

/** The rig facing bed `bed` (whatever its state), or 0. */
export function rigFacing(world: World, modules: Readonly<Record<string, ModuleDef>>, bed: number): number {
  const b = world.get(bed, ModuleC);
  const bedDef = b && modules[b.def];
  if (!b || !bedDef) return 0;
  for (const id of world.query(ModuleC)) {
    const m = world.get(id, ModuleC) as Module;
    const def = modules[m.def];
    if (def?.rig?.bed === b.def && rigFitsBed(def, m.x, m.y, m.rot, bedDef, b.x, b.y, b.rot)) return id;
  }
  return 0;
}

/** The bed a rig faces (built), or 0: a rig whose bed is gone serves nothing. */
export function bedOfRig(world: World, modules: Readonly<Record<string, ModuleDef>>, grid: Grid, rig: number): number {
  const m = world.get(rig, ModuleC);
  const def = m && modules[m.def];
  if (!m || !def?.rig) return 0;
  const front = rigFront(def, m.x, m.y, m.rot);
  if (!grid.inBounds(front.x, front.y)) return 0;
  const bed = grid.get('module', front.x, front.y);
  const b = world.get(bed, ModuleC);
  const bedDef = b && modules[b.def];
  return b && bedDef && b.def === def.rig.bed && rigFitsBed(def, m.x, m.y, m.rot, bedDef, b.x, b.y, b.rot) ? bed : 0;
}
