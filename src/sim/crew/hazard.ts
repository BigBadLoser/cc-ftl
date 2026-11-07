import type { Grid } from '../grid';
import { hasSuitAir } from '../eva/suit';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import {
  CO2_HARM_ABOVE, CO2_HARM_PER_SEC, COLD_BELOW, FIRE_CREW_DAMAGE, HOT_ABOVE, O2_HARM_BELOW, O2_HARM_PER_SEC, SUIT_HEAT_MAX, TEMP_HARM_PER_SEC,
} from '../tuning';
import { CrewC, PositionC, type Crew } from './components';

/**
 * What harms a crew member on a tile (the vitals system deals it; the crew AI's `hazard` interrupt walks them off it,
 * docs/CREW_AI.md section 5). Thin air and CO2 do not touch a crew member breathing from a suit's tank or a body that does not
 * breathe; a suit also keeps out the cold, and heat up to SUIT_HEAT_MAX (a suited worker stays in a hot room, eva/suit.ts `suitNeeded`). Fire it never keeps out.
 */

/** The heat a crew member starts to suffer above: HOT_ABOVE bare, SUIT_HEAT_MAX in a suit with air. */
const hotAbove = (suited: boolean): number => (suited ? SUIT_HEAT_MAX : HOT_ABOVE);

/** Hazard kinds, as bits: what a task can declare it tolerates. */
export const HAZARD_AIR = 1;
export const HAZARD_HEAT = 2;
export const HAZARD_COLD = 4;
export const HAZARD_FIRE = 8;

/** Harm per second from a tile: thin air, CO2, heat, cold and fire. */
export function tileHarm(grid: Grid, x: number, y: number, suited: boolean, airless: boolean): number {
  let harm = 0;
  const o2 = grid.get('o2', x, y);
  const co2 = grid.get('co2', x, y);
  const temp = grid.get('temp', x, y);
  if (!suited && !airless && o2 < O2_HARM_BELOW) harm += (O2_HARM_BELOW - o2) * O2_HARM_PER_SEC;
  if (!suited && !airless && co2 > CO2_HARM_ABOVE) harm += (co2 - CO2_HARM_ABOVE) * CO2_HARM_PER_SEC;
  if (temp > hotAbove(suited)) harm += (temp - hotAbove(suited)) * TEMP_HARM_PER_SEC;
  if (!airless && !suited && temp < COLD_BELOW) harm += (COLD_BELOW - temp) * TEMP_HARM_PER_SEC;
  harm += (FIRE_CREW_DAMAGE * grid.get('fire', x, y)) / 255;
  return harm;
}

/** The hazards (bits) of a tile for a crew member breathing from a suit (`suited`) or not breathing at all (`airless`). */
export function tileHazards(grid: Grid, x: number, y: number, suited: boolean, airless: boolean): number {
  if (!grid.inBounds(x, y)) return 0;
  let h = 0;
  if (!suited && !airless && (grid.get('o2', x, y) < O2_HARM_BELOW || grid.get('co2', x, y) > CO2_HARM_ABOVE)) h |= HAZARD_AIR;
  const temp = grid.get('temp', x, y);
  if (temp > hotAbove(suited)) h |= HAZARD_HEAT;
  if (!airless && !suited && temp < COLD_BELOW) h |= HAZARD_COLD;
  if (grid.get('fire', x, y) > 0) h |= HAZARD_FIRE;
  return h;
}

/** How a crew member meets a tile's hazards: breathing from a suit, or not breathing at all. */
export function exposure(sim: Sim, id: number): { suited: boolean; airless: boolean } {
  const c = sim.world.get(id, CrewC) as Crew | undefined;
  return { suited: hasSuitAir(sim, id), airless: !!(c && sim.content.species[c.species]?.airless) };
}

/** The hazards of the tile the crew member stands on (where their current step began, as the vitals system reads it), as bits; 0 when it is safe. */
export function hazardsHere(sim: Sim, id: number): number {
  const pos = sim.world.get(id, PositionC);
  const grid = pos && shipGrid(sim, shipIdOf(sim, pos));
  if (!pos || !grid) return 0;
  const { suited, airless } = exposure(sim, id);
  return tileHazards(grid, pos.x, pos.y, suited, airless);
}
