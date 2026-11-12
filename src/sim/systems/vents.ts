import { airHazardAt } from '../crew/hazard';
import { networkHasPower } from '../modules/gridPower';
import { fieldFrame, tilesOf } from '../diffusion';
import type { GridLike } from '../grid';
import { regions } from '../regions';
import type { Sim } from '../sim';
import { Struct, VentState, gasConductance, ventWanted } from '../structure';

const isDoorKind = (kind: number): boolean => kind === Struct.Door;
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * Why a vent is held shut, or Open when it may stay open (the player's setting is open): `HeldNoPower` while the ship's network has no
 * power (a vent fails shut and draws nothing itself), `HeldHazard` while any side that gas reaches has a hazard (`airHazardAt`:
 * fire, smoke, vacuum or thin air, bad air, dangerous heat or cold). The one owner of that answer; the system and tests call it.
 */
export function ventHold(sim: Sim, ship: number, grid: GridLike, x: number, y: number): number {
  if (!networkHasPower(sim, ship)) return VentState.HeldNoPower;
  for (const [dx, dy] of SIDES) {
    const nx = x + dx, ny = y + dy;
    if (!grid.inBounds(nx, ny) || gasConductance(grid.get('struct', nx, ny), 255) <= 0) continue; // a wall side holds no gas
    if (airHazardAt(grid, nx, ny)) return VentState.HeldHazard;
  }
  return VentState.Open;
}

/**
 * Vents on doors. The player's setting is the `vent` field being non-zero; this system decides each tick whether a vent set open is
 * open (`ventHold`): held shut by a hazard or by no power, and open again by itself when that clears. A vent whose door is gone is cleared where the door goes (writeStruct, damageStruct).
 * Runs before the atmosphere solver, which lets an open vent pass air and pressure through a shut door (never fire, heat or smoke).
 */
export function ventsSystem(sim: Sim): void {
  for (const { grid, ship } of regions(sim)) {
    if (!grid.has('vent') || !grid.has('struct')) continue;
    for (const i of tilesOf(fieldFrame(grid), isDoorKind)) {
      const x = grid.x0 + (i % grid.width), y = grid.y0 + Math.floor(i / grid.width);
      const cur = grid.get('vent', x, y);
      if (cur === 0) continue;
      const next = ventWanted(cur) ? ventHold(sim, ship, grid, x, y) : VentState.Closed;
      if (next !== cur) grid.set('vent', x, y, next);
    }
  }
}
