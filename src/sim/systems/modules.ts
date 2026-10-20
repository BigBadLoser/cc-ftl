import { footprintTiles } from '../modules/footprint';
import { ModuleC } from '../modules/components';
import { roomTiles } from '../roomIndex';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { GAS_EPSILON, NORMAL_O2 } from '../tuning';

/**
 * Running modules act on the grid fields: life support adds oxygen and scrubs CO2 across its
 * room (or just its own tile if it somehow has none), reactors heat their footprint. Only
 * powered modules act; lights are handled by the lighting system.
 */
export function modulesSystem(sim: Sim): void {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    const grid = m && sim.grids.get(m.gridId);
    if (!m || !def || !grid?.has('o2') || !m.powered || m.hp <= 0) continue;

    if (def.o2PerSec || def.co2ScrubPerSec) {
      const room = grid.get('room', m.x, m.y);
      const tiles = room ? roomTiles(grid).get(room) : undefined;
      const idx = tiles ?? [(m.y - grid.y0) * grid.width + (m.x - grid.x0)];
      const addO2 = ((def.o2PerSec ?? 0) / TICK_HZ) / idx.length;
      const scrub = ((def.co2ScrubPerSec ?? 0) / TICK_HZ) / idx.length;
      for (const i of idx) {
        const x = grid.x0 + (i % grid.width);
        const y = grid.y0 + Math.floor(i / grid.width);
        const cur = grid.get('o2', x, y);
        if (addO2 > 0 && cur < NORMAL_O2 - GAS_EPSILON) grid.set('o2', x, y, Math.min(NORMAL_O2, cur + addO2));
        const c = grid.get('co2', x, y);
        if (scrub > 0 && c > GAS_EPSILON) grid.set('co2', x, y, Math.max(0, c - scrub));
      }
    }

    if (def.heatPerSec) {
      const tiles = footprintTiles(def, m.x, m.y, m.rot);
      const heat = def.heatPerSec / TICK_HZ / tiles.length;
      for (const t of tiles) grid.set('temp', t.x, t.y, grid.get('temp', t.x, t.y) + heat);
    }
  }
}
