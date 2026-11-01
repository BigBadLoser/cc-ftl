import { footprintTiles } from '../modules/footprint';
import { ModuleC } from '../modules/components';
import { roomTiles } from '../roomIndex';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { GAS_EPSILON, NORMAL_O2 } from '../tuning';
import { shipIdOf, shipGrid } from '../regions';
import { drawFromStores, shipStoreCount } from '../items/stock';

/**
 * Running modules act on the grid fields: life support adds oxygen and scrubs CO2 across its
 * room (or just its own tile if it somehow has none), faster with bottled oxygen in the ship's stores while the room is short of air
 * (`ModuleDef.o2Supply`), and reactors heat their footprint. Only powered modules act; lights are handled by the lighting system.
 */
/** A room counts as short of air below this share of normal oxygen: bottled oxygen boosts the refill only then. */
const O2_SHORT = 0.9;

export function modulesSystem(sim: Sim): void {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    // Only running modules with a field effect act; check that before the ship lookup (pure checks, same result).
    if (!m || !def || !m.powered || m.hp <= 0 || !(def.o2PerSec || def.co2ScrubPerSec || def.heatPerSec)) continue;
    const grid = shipGrid(sim, shipIdOf(sim, m));
    if (!grid?.has('o2')) continue;

    if (def.o2PerSec || def.co2ScrubPerSec) {
      const room = grid.get('room', m.x, m.y);
      const tiles = room ? roomTiles(grid).get(room) : undefined;
      const idx = tiles ?? [(m.y - grid.y0) * grid.width + (m.x - grid.x0)];
      // Bottled oxygen in the stores speeds the air up while the room is short of it; a full room burns none.
      let boost = 1;
      const supply = def.o2Supply;
      if (supply && def.o2PerSec) {
        // Short of air: the room's average below O2_SHORT of normal (a breach, a fire, a fresh room), not the small dips of everyday mixing.
        let sum = 0;
        for (const i of idx) sum += grid.get('o2', grid.x0 + (i % grid.width), grid.y0 + Math.floor(i / grid.width));
        const short = sum / idx.length < NORMAL_O2 * O2_SHORT;
        const ship = shipIdOf(sim, m);
        if (short && ((m.o2Burn ?? 0) > 0 || shipStoreCount(sim, ship, supply.item) > 0)) {
          boost = supply.mult;
          // A unit is burned when the boost starts and covers `secPerUnit` seconds.
          if ((m.o2Burn ?? 0) <= 0) {
            if (drawFromStores(sim, ship, supply.item, 1) < 1) boost = 1;
            else m.o2Burn = supply.secPerUnit;
          }
          if (boost > 1) m.o2Burn = Math.max(0, (m.o2Burn ?? 0) - 1 / TICK_HZ);
        }
      }
      const addO2 = (((def.o2PerSec ?? 0) * boost) / TICK_HZ) / idx.length;
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
