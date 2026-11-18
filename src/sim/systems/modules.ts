import { footprintTiles } from '../modules/footprint';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { shipGrid } from '../regions';
import { modulesWhere, type DefTest } from '../modules/byShip';

/**
 * Running modules act on the grid fields: reactors heat their footprint. Only powered modules act; lights are handled by the lighting
 * system. Life support's oxygen and CO2 scrubbing run inside the gas solve, a tick at a time between its substeps (modules/lifeSupport.ts,
 * systems/atmosphere.ts, #65).
 */
const heats: DefTest = (d) => !!d.heatPerSec;

export function modulesSystem(sim: Sim): void {
  const actors = modulesWhere(sim, heats);
  for (let k = 0; k < actors.ids.length; k++) {
    const m = sim.world.get(actors.ids[k] as number, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || !m.powered || m.hp <= 0 || !def.heatPerSec) continue;
    const grid = shipGrid(sim, actors.ships[k] as number);
    if (!grid?.has('o2')) continue;
    const tiles = footprintTiles(def, m.x, m.y, m.rot);
    const heat = def.heatPerSec / TICK_HZ / tiles.length;
    for (const t of tiles) grid.set('temp', t.x, t.y, grid.get('temp', t.x, t.y) + heat);
  }
}
