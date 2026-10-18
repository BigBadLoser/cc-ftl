import { releaseBed, releaseBedClaim } from '../crew/beds';
import {
  CrewC, DeadC, DownedC, DraftedC, HealthC, PositionC,
  type Crew, type Downed, type Health, type Position,
} from '../crew/components';
import { killCrew } from '../crew/death';
import { releaseAssignment } from '../crew/helpers';
import type { Grid } from '../grid';
import { SuitC } from '../portals/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import {
  BED_HEAL_PER_SEC, BLEED_OUT_SECONDS, BREATH_CO2_PER_SEC, BREATH_O2_PER_SEC, CO2_HARM_ABOVE, CO2_HARM_PER_SEC,
  COLD_BELOW, FIRE_CREW_DAMAGE, GET_UP_HP, HOT_ABOVE, O2_HARM_BELOW, O2_HARM_PER_SEC, REGEN_PER_SEC,
  TEMP_HARM_PER_SEC,
} from '../tuning';

/** Harm per second from the tile a crew member stands on: thin air, CO2, heat, cold and fire. */
function harmPerSec(grid: Grid, x: number, y: number, suited: boolean): number {
  let harm = 0;
  const o2 = grid.get('o2', x, y);
  const co2 = grid.get('co2', x, y);
  const temp = grid.get('temp', x, y);
  if (!suited && o2 < O2_HARM_BELOW) harm += (O2_HARM_BELOW - o2) * O2_HARM_PER_SEC;
  if (!suited && co2 > CO2_HARM_ABOVE) harm += (co2 - CO2_HARM_ABOVE) * CO2_HARM_PER_SEC;
  if (temp > HOT_ABOVE) harm += (temp - HOT_ABOVE) * TEMP_HARM_PER_SEC;
  if (temp < COLD_BELOW) harm += (COLD_BELOW - temp) * TEMP_HARM_PER_SEC;
  harm += (FIRE_CREW_DAMAGE * grid.get('fire', x, y)) / 255;
  return harm;
}

/**
 * Living crew breathe (use O2, emit CO2 on their tile) and take environmental harm. At 0 hp they
 * are downed and bleed out unless a rescuer stabilizes them in a bed, where they heal and
 * eventually get up. A downed crew whose air is still lethal keeps bleeding even in a bed.
 * Crew without a Health component are ignored.
 */
export function vitalsSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, HealthC, PositionC)) {
    if (sim.world.has(id, DeadC)) continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const grid = sim.grids.get(pos.gridId);
    if (!grid?.has('o2') || !grid.inBounds(pos.x, pos.y)) continue;
    const health = sim.world.get(id, HealthC) as Health;
    const downed = sim.world.get(id, DownedC);

    const suited = sim.world.has(id, SuitC); // a suit has its own air: no breathing from the tile, no thin-air harm
    if (!suited) {
      grid.set('o2', pos.x, pos.y, Math.max(0, grid.get('o2', pos.x, pos.y) - BREATH_O2_PER_SEC / TICK_HZ));
      grid.set('co2', pos.x, pos.y, grid.get('co2', pos.x, pos.y) + BREATH_CO2_PER_SEC / TICK_HZ);
    }

    const harm = harmPerSec(grid, pos.x, pos.y, suited);
    if (!downed) {
      if (health.hp <= 0) {
        // Already at 0 (combat damage): go down without regenerating first.
      } else if (harm > 0) health.hp = Math.max(0, health.hp - harm / TICK_HZ);
      else health.hp = Math.min(health.max, health.hp + REGEN_PER_SEC / TICK_HZ);
      if (health.hp <= 0) down(sim, id, pos);
    } else if (downed.stabilized && harm < BED_HEAL_PER_SEC) {
      health.hp = Math.min(health.max, health.hp + (BED_HEAL_PER_SEC - harm) / TICK_HZ);
      if (health.hp >= GET_UP_HP) getUp(sim, id, downed);
    } else {
      health.hp = Math.max(0, health.hp - harm / TICK_HZ);
      downed.bleed -= 1 / TICK_HZ;
      if (downed.bleed <= 0) die(sim, id, downed);
    }
  }
}

function down(sim: Sim, id: number, pos: Position): void {
  const crew = sim.world.get(id, CrewC) as Crew;
  releaseAssignment(sim, id);
  releaseBedClaim(sim, id);
  sim.world.remove(id, DraftedC);
  pos.toX = pos.x;
  pos.toY = pos.y;
  pos.progress = 0;
  sim.world.add(id, DownedC, { bleed: BLEED_OUT_SECONDS, stabilized: false, bed: 0 });
  crew.activity = 'downed';
  sim.events.emit({ type: 'crew.downed', crew: id });
}

function getUp(sim: Sim, id: number, downed: Downed): void {
  releaseBed(sim, downed.bed, id);
  sim.world.remove(id, DownedC);
  (sim.world.get(id, CrewC) as Crew).activity = 'idle';
}

function die(sim: Sim, id: number, downed: Downed): void {
  releaseBed(sim, downed.bed, id);
  killCrew(sim, id);
}
