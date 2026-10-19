import { ItemStackC } from '../items/components';
import { ModuleC } from '../modules/components';
import type { Grid } from '../grid';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { stochasticRound } from '../stochastic';
import { TICK_HZ } from '../time';
import { Struct, gasConductance } from '../structure';
import {
  FIRE_CO2_MAKE, FIRE_DECAY_PER_SEC, FIRE_GROWTH_PER_SEC, FIRE_HEAT, FIRE_MIN_O2, FIRE_MODULE_DAMAGE,
  FIRE_O2_USE, FIRE_SMOKE, FIRE_SPREAD_PER_SEC, FIRE_STARVE_PER_SEC, FIRE_START_INTENSITY,
  FLOOR_FLAMMABILITY, NORMAL_O2,
} from '../tuning';

const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const O2_RANGE = NORMAL_O2 - FIRE_MIN_O2;

/** Fuel at a tile: the most flammable of bare floor, the module standing on it and a loose item stack. */
function fuelAt(sim: Sim, grid: Grid, x: number, y: number): number {
  const id = grid.get('module', x, y);
  const m = id ? sim.world.get(id, ModuleC) : undefined;
  const sid = grid.has('item') ? grid.get('item', x, y) : 0;
  const stack = sid ? sim.world.get(sid, ItemStackC) : undefined;
  const itemFuel = stack ? (sim.content.items[stack.item]?.flammability ?? 0) : 0;
  return Math.max(FLOOR_FLAMMABILITY, itemFuel, m ? (sim.content.modules[m.def]?.flammability ?? 0) : 0);
}

const o2Factor = (o2: number): number => Math.max(0, Math.min(1, (o2 - FIRE_MIN_O2) / O2_RANGE));

/**
 * Fire needs oxygen above FIRE_MIN_O2. Burning tiles use O2 and make CO2, heat and smoke in
 * proportion to intensity, grow on flammable modules (and barely on bare floor), damage the
 * module underneath, and spread to neighbouring gas-passable tiles by random chance scaled by
 * intensity x fuel x oxygen. Without oxygen the fire collapses. Crew damage is in vitals.
 */
export function fireSystem(sim: Sim): void {
  for (const { grid } of regions(sim)) {
    if (!grid.has('fire') || !grid.has('o2')) continue;
    const { width, height } = grid;
    // A snapshot: this loop only writes the tile it is on, and spreads are applied after it.
    const fire = grid.load('fire');
    const ignite: number[] = [];
    for (let i = 0; i < fire.length; i++) {
      const f = fire[i] as number;
      if (f === 0) continue;
      const x = i % width;
      const y = (i - x) / width;
      const kind = grid.get('struct', x, y);
      if (kind !== Struct.Floor && kind !== Struct.Door) {
        grid.set('fire', x, y, 0);
        continue;
      }
      const o2 = grid.get('o2', x, y);
      const fuel = fuelAt(sim, grid, x, y);
      const of = o2Factor(o2);
      const delta = of > 0 ? (fuel * FIRE_GROWTH_PER_SEC * of - FIRE_DECAY_PER_SEC) / TICK_HZ : -FIRE_STARVE_PER_SEC / TICK_HZ;
      burn(sim, grid, x, y, f / 255);
      const next = Math.max(0, Math.min(255, f + stochasticRound(sim, Math.abs(delta)) * Math.sign(delta)));
      if (next !== f) grid.set('fire', x, y, next);
      if (next === 0) continue;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nk = grid.get('struct', nx, ny);
        if (grid.get('fire', nx, ny) !== 0 || gasConductance(nk, grid.get('door', nx, ny)) <= 0 || nk === Struct.Space) continue;
        const chance = (FIRE_SPREAD_PER_SEC / TICK_HZ) * (f / 255) * fuelAt(sim, grid, nx, ny) * o2Factor(grid.get('o2', nx, ny));
        if (chance > 0 && sim.rng.chance(chance)) ignite.push(ny * width + nx);
      }
    }
    for (const i of ignite) {
      const x = i % width;
      const y = (i - x) / width;
      if (grid.get('fire', x, y) === 0) grid.set('fire', x, y, FIRE_START_INTENSITY);
    }
  }
}

/** Per-tick effects of a burning tile at `level` (0..1 of full intensity). */
function burn(sim: Sim, grid: Grid, x: number, y: number, level: number): void {
  const o2 = grid.get('o2', x, y);
  grid.set('o2', x, y, Math.max(0, o2 - (FIRE_O2_USE * level) / TICK_HZ));
  grid.set('co2', x, y, grid.get('co2', x, y) + (FIRE_CO2_MAKE * level) / TICK_HZ);
  grid.set('temp', x, y, grid.get('temp', x, y) + (FIRE_HEAT * level) / TICK_HZ);
  const smoke = grid.get('smoke', x, y);
  const addSmoke = stochasticRound(sim, (FIRE_SMOKE * level) / TICK_HZ);
  if (addSmoke > 0 && smoke < 255) grid.set('smoke', x, y, Math.min(255, smoke + addSmoke));
  const id = grid.get('module', x, y);
  const m = id ? sim.world.get(id, ModuleC) : undefined;
  if (m && m.hp > 0) m.hp = Math.max(0, m.hp - (FIRE_MODULE_DAMAGE * level) / TICK_HZ);
}
