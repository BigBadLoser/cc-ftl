import type { Faction } from '../combat/components';
import { shipOf } from '../combat/ships';
import { CrewC, DeadC } from '../crew/components';
import { isTileOccupied } from '../crew/helpers';
import { createCrew } from '../crew/spawn';
import { ModuleC, type Module } from '../modules/components';
import { accessTile, rotatedSize } from '../modules/footprint';
import { isTileWalkable } from '../modules/walk';
import type { ModuleDef } from '../registry';
import { FabricatorC, type Fabricator } from '../robots/components';
import { hasLiveCore } from '../robots/core';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { gridIdOf } from '../regions';

/**
 * Robot fabricators (ModuleDef.robotFabricator): the seed of rogue AI shipyards. While intact, powered and on a ship
 * whose AI core is live (for the ship's own faction), a fabricator counts toward its interval and then builds the
 * next robot of its role list on its access tile (or the nearest free floor around it), for the ship's faction.
 * It pauses at `cap` live robots of its own make; the clock waits while it is off or the core is down.
 */
export function fabricatorSystem(sim: Sim): void {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC) as Module;
    const def = sim.content.modules[m.def];
    const fab = def?.robotFabricator;
    const ship = fab ? shipOf(sim, gridIdOf(sim, m)) : undefined;
    if (!def || !fab || !ship || fab.roles.length === 0) continue;
    if (m.hp <= 0 || !m.powered || !hasLiveCore(sim, gridIdOf(sim, m), ship.faction)) continue;
    let st = sim.world.get(id, FabricatorC);
    if (!st) sim.world.add(id, FabricatorC, (st = { timer: 0, made: [], count: 0 }));
    st.made = st.made.filter((r) => sim.world.has(r, CrewC) && !sim.world.has(r, DeadC));
    if (st.made.length >= fab.cap) {
      st.timer = 0;
      continue;
    }
    if (st.timer < Math.round(fab.intervalSec * TICK_HZ)) {
      st.timer++;
      continue;
    }
    build(sim, id, m, def, st, ship.faction, fab.roles[st.count % fab.roles.length] as string);
  }
}

function build(sim: Sim, id: number, m: Module, def: ModuleDef, st: Fabricator, faction: Faction, role: string): void {
  const tile = spawnTile(sim, m, def);
  if (!tile) return; // blocked: try again next tick
  const robot = createCrew(sim, gridIdOf(sim, m), role, tile, { faction });
  if (!robot) return;
  st.timer = 0;
  st.count++;
  st.made.push(robot);
  sim.events.emit({ type: 'robot.fabricated', crew: robot, moduleId: id, gridId: gridIdOf(sim, m) });
}

/** The access tile if it is free, else the first free walkable tile in rings (up to 3) around the footprint. */
function spawnTile(sim: Sim, m: Module, def: ModuleDef): { x: number; y: number } | null {
  const grid = sim.grids.get(gridIdOf(sim, m));
  if (!grid?.has('struct')) return null;
  const free = (x: number, y: number): boolean => grid.inBounds(x, y) && isTileWalkable(sim, grid, x, y) && !isTileOccupied(sim, gridIdOf(sim, m), x, y);
  const at = accessTile(def, m.x, m.y, m.rot);
  if (at && free(at.x, at.y)) return at;
  const [w, h] = rotatedSize(def, m.rot);
  for (let r = 1; r <= 3; r++) {
    for (let y = m.y - r; y < m.y + h + r; y++) {
      for (let x = m.x - r; x < m.x + w + r; x++) {
        const ring = x === m.x - r || x === m.x + w + r - 1 || y === m.y - r || y === m.y + h + r - 1;
        if (ring && free(x, y)) return { x, y };
      }
    }
  }
  return null;
}
