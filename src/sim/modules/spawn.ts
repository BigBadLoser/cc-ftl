import { PointDefenseC, WeaponC } from '../combat/components';
import { CrewC, JobC, PositionC } from '../crew/components';
import { ProductionC, StorageC } from '../items/components';
import { spillItems } from '../items/stacks';
import type { Sim } from '../sim';
import { DEFAULT_PRIORITY } from '../tuning';
import { Struct } from '../structure';
import { ModuleC } from './components';
import { accessTile, footprintTiles, hullOutward, hullRow, hullSide, inFootprint, openTilesOf } from './footprint';
import { isTileWalkable } from './walk';
import { dismantleAirlock, initAirlock } from '../portals/airlock';
import { removePortalsOfAirlock } from '../portals/graph';
import { VehicleBayC } from '../vehicles/components';
import { releaseBayVehicle } from '../vehicles/lifecycle';
import { gridIdOf } from '../regions';

/** Create a module entity and claim its footprint in the grid. Assumes placement was validated. */
export function spawnModule(sim: Sim, gridId: number, defId: string, x: number, y: number, rot: number): number {
  const def = sim.content.modules[defId];
  const grid = sim.grids.get(gridId);
  if (!def || !grid) throw new Error(`spawnModule: unknown def "${defId}" or grid ${gridId}`);
  const id = sim.world.createEntity();
  sim.world.add(id, ModuleC, {
    def: defId, x, y, rot, hp: def.maxHp, priority: def.priority ?? DEFAULT_PRIORITY,
    enabled: true, powered: false, reservedBy: 0,
  });
  if (def.storage) sim.world.add(id, StorageC, { capacity: def.storage.capacity, filter: null, stacks: [] });
  if (def.weapon) sim.world.add(id, WeaponC, { charge: 0, target: null, shotsLeft: 0, nextShotTick: 0, volleyTarget: null, aim: 0 });
  if (def.pointDefense) sim.world.add(id, PointDefenseC, { aim: 0 });
  if (def.crafting) sim.world.add(id, ProductionC, { orders: [] });
  if (def.vehicleBay) sim.world.add(id, VehicleBayC, { vehicle: 0 });
  for (const t of footprintTiles(def, x, y, rot)) grid.set('module', t.x, t.y, id);
  if (def.airlock) initAirlock(sim, grid, id);
  return id;
}

/** Remove a module: free its tiles and drop it from the world. */
export function removeModule(sim: Sim, id: number): void {
  const m = sim.world.get(id, ModuleC);
  if (!m) return;
  const def = sim.content.modules[m.def];
  const grid = sim.grids.get(gridIdOf(sim, m));
  if (def && grid) {
    if (def.airlock) {
      dismantleAirlock(sim, grid, id);
      removePortalsOfAirlock(sim, id);
    }
    for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
      if (grid.inBounds(t.x, t.y) && grid.get('module', t.x, t.y) === id) grid.set('module', t.x, t.y, 0);
    }
  }
  if (def?.vehicleBay) releaseBayVehicle(sim, id, gridIdOf(sim, m), m.x, m.y);
  for (const st of sim.world.get(id, StorageC)?.stacks ?? []) spillItems(sim, gridIdOf(sim, m), m.x, m.y, st.item, st.count);
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
  const wallRow = hullRow(def, x, y, rot);
  for (const t of tiles) {
    if (!grid.inBounds(t.x, t.y)) return 'outOfBounds';
    const onWall = wallRow.some((w) => w.x === t.x && w.y === t.y);
    if (onWall ? grid.get('struct', t.x, t.y) !== Struct.Wall : grid.get('struct', t.x, t.y) !== Struct.Floor) {
      return onWall ? 'notOnHull' : 'notFloor';
    }
    if (grid.get('module', t.x, t.y) !== 0) return 'occupied';
  }
  const side = hullSide(def, rot);
  if (side) {
    // The wall row must be exterior hull: Space right beyond every tile of it.
    const out = hullOutward(side);
    for (const t of wallRow) {
      const bx = t.x + out.x;
      const by = t.y + out.y;
      if (!grid.inBounds(bx, by) || grid.get('struct', bx, by) !== Struct.Space) return 'notOnHull';
    }
  }
  const access = accessTile(def, x, y, rot);
  if (access) {
    const inside = inFootprint(def, x, y, rot, access.x, access.y);
    if (inside ? !openTilesOf(def, x, y, rot).some((o) => o.x === access.x && o.y === access.y) : !isTileWalkable(sim, grid, access.x, access.y)) {
      return 'noAccess';
    }
  }
  for (const jobId of sim.world.query(JobC)) {
    const j = sim.world.get(jobId, JobC);
    if (j?.kind !== 'module' || gridIdOf(sim, j) !== gridId || !j.module) continue;
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
  const open = openTilesOf(def, x, y, rot);
  const tiles = footprintTiles(def, x, y, rot).filter((t) => !open.some((o) => o.x === t.x && o.y === t.y));
  for (const id of sim.world.query(CrewC, PositionC)) {
    const p = sim.world.get(id, PositionC);
    if (!p || gridIdOf(sim, p) !== gridId) continue;
    if (tiles.some((t) => (t.x === p.x && t.y === p.y) || (t.x === p.toX && t.y === p.toY))) return true;
  }
  return false;
}
