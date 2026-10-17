import { WeaponC } from '../combat/components';
import { CrewC, JobC, PositionC } from '../crew/components';
import { ProductionC, StorageC } from '../items/components';
import { spillItems } from '../items/stacks';
import type { Grid } from '../grid';
import type { Sim } from '../sim';
import { DEFAULT_PRIORITY } from '../tuning';
import { Struct, bordersSpace } from '../structure';
import { ModuleC } from './components';
import { accessTile, footprintTiles } from './footprint';
import { isTileWalkable } from './walk';

/** Create a module entity and claim its footprint in the grid. Assumes placement was validated. */
export function spawnModule(sim: Sim, gridId: number, defId: string, x: number, y: number, rot: number): number {
  const def = sim.content.modules[defId];
  const grid = sim.grids.get(gridId);
  if (!def || !grid) throw new Error(`spawnModule: unknown def "${defId}" or grid ${gridId}`);
  const id = sim.world.createEntity();
  sim.world.add(id, ModuleC, {
    def: defId, gridId, x, y, rot, hp: def.maxHp, priority: def.priority ?? DEFAULT_PRIORITY,
    enabled: true, powered: false, reservedBy: 0,
  });
  if (def.storage) sim.world.add(id, StorageC, { capacity: def.storage.capacity, filter: null, stacks: [] });
  if (def.weapon) sim.world.add(id, WeaponC, { charge: 0, target: null, shotsLeft: 0, nextShotTick: 0, volleyTarget: null });
  if (def.crafting) sim.world.add(id, ProductionC, { orders: [] });
  for (const t of footprintTiles(def, x, y, rot)) grid.set('module', t.x, t.y, id);
  return id;
}

/** Remove a module: free its tiles and drop it from the world. */
export function removeModule(sim: Sim, id: number): void {
  const m = sim.world.get(id, ModuleC);
  if (!m) return;
  const def = sim.content.modules[m.def];
  const grid = sim.grids.get(m.gridId);
  if (def && grid) {
    for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
      if (grid.inBounds(t.x, t.y) && grid.get('module', t.x, t.y) === id) grid.set('module', t.x, t.y, 0);
    }
  }
  for (const st of sim.world.get(id, StorageC)?.stacks ?? []) spillItems(sim, m.gridId, m.x, m.y, st.item, st.count);
  sim.world.destroyEntity(id);
}

/**
 * Why a module cannot be placed here, or null if it can. Checks bounds, floor, free tiles,
 * a walkable access tile and overlap with other module blueprints (jobs).
 */
export function placementError(sim: Sim, gridId: number, defId: string, x: number, y: number, rot: number): string | null {
  const grid = sim.grids.get(gridId);
  const def = sim.content.modules[defId];
  if (!grid?.has('module')) return 'badGrid';
  if (!def) return 'badDef';
  if (!Number.isInteger(rot) || rot < 0 || rot > 3) return 'badRot';
  const tiles = footprintTiles(def, x, y, rot);
  for (const t of tiles) {
    if (!grid.inBounds(t.x, t.y)) return 'outOfBounds';
    if (grid.get('struct', t.x, t.y) !== Struct.Floor) return 'notFloor';
    if (grid.get('module', t.x, t.y) !== 0) return 'occupied';
  }
  if (def.mount === 'hull' && !touchesHull(grid, tiles)) return 'notOnHull';
  const access = accessTile(def, x, y, rot);
  if (access && !isTileWalkable(sim, grid, access.x, access.y)) return 'noAccess';
  for (const jobId of sim.world.query(JobC)) {
    const j = sim.world.get(jobId, JobC);
    if (j?.kind !== 'module' || j.gridId !== gridId || !j.module) continue;
    const other = sim.content.modules[j.module.def];
    if (!other) continue;
    const theirs = footprintTiles(other, j.x, j.y, j.module.rot);
    if (theirs.some((a) => tiles.some((b) => a.x === b.x && a.y === b.y))) return 'jobExists';
  }
  return null;
}

/** True if a crew member stands on, or is stepping onto, any footprint tile of a solid module. */
export function footprintBlockedByCrew(sim: Sim, gridId: number, defId: string, x: number, y: number, rot: number): boolean {
  const def = sim.content.modules[defId];
  if (!def?.solid) return false;
  const tiles = footprintTiles(def, x, y, rot);
  for (const id of sim.world.query(CrewC, PositionC)) {
    const p = sim.world.get(id, PositionC);
    if (!p || p.gridId !== gridId) continue;
    if (tiles.some((t) => (t.x === p.x && t.y === p.y) || (t.x === p.toX && t.y === p.toY))) return true;
  }
  return false;
}

/** True if any footprint tile has a 4-neighbour that is a wall tile bordering Space (or the grid edge). */
export function touchesHull(grid: Grid, tiles: readonly { x: number; y: number }[]): boolean {
  for (const t of tiles) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (grid.inBounds(nx, ny) && grid.get('struct', nx, ny) === Struct.Wall && bordersSpace(grid, nx, ny)) return true;
    }
  }
  return false;
}
