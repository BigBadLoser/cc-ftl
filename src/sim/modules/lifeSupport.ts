import { drawFromStores, shipStoreCount } from '../items/stock';
import type { GridLike } from '../grid';
import { roomTiles } from '../roomIndex';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { NORMAL_O2 } from '../tuning';
import { GAS_EPSILON } from '../tuningGas';
import { modulesOn, type DefTest } from './byShip';
import { ModuleC, type Module } from './components';
import type { ModuleDef } from '../registry';

/** A room counts as short of air below this share of normal oxygen: bottled oxygen boosts the refill only then. */
const O2_SHORT = 0.9;

const breathes: DefTest = (d) => !!(d.o2PerSec || d.co2ScrubPerSec);

/** The running life-support modules of a ship with the tiles each acts on (its room, or its own tile without one), as indices of `grid`. */
function running(sim: Sim, ship: number, grid: GridLike): { m: Module; def: ModuleDef; idx: readonly number[] }[] {
  const out: { m: Module; def: ModuleDef; idx: readonly number[] }[] = [];
  for (const id of modulesOn(sim, ship, breathes)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || !m.powered || m.hp <= 0) continue;
    const room = grid.has('room') ? grid.get('room', m.x, m.y) : 0;
    const tiles = room ? roomTiles(grid).get(room) : undefined;
    out.push({ m, def, idx: tiles ?? [(m.y - grid.y0) * grid.width + (m.x - grid.x0)] });
  }
  return out;
}

/**
 * One tick of the ship's life support on its gas, held row-major over `grid` (`o2`, `co2`): each running module adds oxygen across its
 * room up to NORMAL_O2 and scrubs its CO2, faster with bottled oxygen in the ship's stores while the room is short of air
 * (`ModuleDef.o2Supply`, a unit burned when the boost starts and covering `secPerUnit` seconds). The gas solver calls it once per tick it
 * covers, before that tick's substeps (systems/atmosphere.ts, #65), so the top-up and the spreading alternate as they would tick by tick.
 */
export function lifeSupportTick(sim: Sim, ship: number, grid: GridLike, o2: Float64Array, co2: Float64Array): void {
  for (const { m, def, idx } of running(sim, ship, grid)) {
    let boost = 1;
    const supply = def.o2Supply;
    if (supply && def.o2PerSec) {
      // Short of air: the room's average below O2_SHORT of normal (a breach, a fire, a fresh room), not the small dips of everyday mixing.
      let sum = 0;
      for (const i of idx) sum += o2[i] as number;
      const short = sum / idx.length < NORMAL_O2 * O2_SHORT;
      if (short && ((m.o2Burn ?? 0) > 0 || shipStoreCount(sim, ship, supply.item) > 0)) {
        boost = supply.mult;
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
      const cur = o2[i] as number;
      if (addO2 > 0 && cur < NORMAL_O2 - GAS_EPSILON) o2[i] = Math.min(NORMAL_O2, cur + addO2);
      const c = co2[i] as number;
      if (scrub > 0 && c > GAS_EPSILON) co2[i] = Math.max(0, c - scrub);
    }
  }
}

/** True if a tick of the ship's life support would change its gas (`lifeSupportTick`'s tests): a room it serves is short of oxygen or holds CO2. */
export function lifeSupportActs(sim: Sim, ship: number, grid: GridLike, o2: Float64Array, co2: Float64Array): boolean {
  for (const { def, idx } of running(sim, ship, grid)) {
    for (const i of idx) {
      if (def.o2PerSec && (o2[i] as number) < NORMAL_O2 - GAS_EPSILON) return true;
      if (def.co2ScrubPerSec && (co2[i] as number) > GAS_EPSILON) return true;
    }
  }
  return false;
}
