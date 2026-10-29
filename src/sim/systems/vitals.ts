import { shipIdOf, shipGrid } from '../regions';
import { abortTask } from '../ai/task';
import { releaseBed } from '../crew/beds';
import {
  CrewC, DeadC, DownedC, DraftedC, HealthC, NeedsC, PositionC,
  type Crew, type Downed, type Health, type Position,
} from '../crew/components';
import { killCrew } from '../crew/death';
import type { Grid } from '../grid';
import { hasSuitAir } from '../eva/suit';
import { WreckC } from '../robots/components';
import { skillOf } from '../combat/operators';
import { AllegianceC } from '../fight/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import {
  BED_HEAL_PER_SEC, BLEED_OUT_SECONDS, BREATH_CO2_PER_SEC, BREATH_O2_PER_SEC, CO2_HARM_ABOVE, CO2_HARM_PER_SEC,
  COLD_BELOW, FIRE_CREW_DAMAGE, GET_UP_HP, HOT_ABOVE, O2_HARM_BELOW, O2_HARM_PER_SEC, REGEN_PER_SEC,
  SKILL_STEP, STARVE_HARM_PER_SEC, TEMP_HARM_PER_SEC,
} from '../tuning';

/** Harm per second from the tile a crew member stands on: thin air, CO2, heat, cold and fire. `suited` (with air in the tank) or airless skips thin air and CO2; a suit also insulates against cold. */
function harmPerSec(grid: Grid, x: number, y: number, suited: boolean, airless: boolean): number {
  let harm = 0;
  const o2 = grid.get('o2', x, y);
  const co2 = grid.get('co2', x, y);
  const temp = grid.get('temp', x, y);
  if (!suited && !airless && o2 < O2_HARM_BELOW) harm += (O2_HARM_BELOW - o2) * O2_HARM_PER_SEC;
  if (!suited && !airless && co2 > CO2_HARM_ABOVE) harm += (co2 - CO2_HARM_ABOVE) * CO2_HARM_PER_SEC;
  if (temp > HOT_ABOVE) harm += (temp - HOT_ABOVE) * TEMP_HARM_PER_SEC;
  if (!airless && !suited && temp < COLD_BELOW) harm += (COLD_BELOW - temp) * TEMP_HARM_PER_SEC;
  harm += (FIRE_CREW_DAMAGE * grid.get('fire', x, y)) / 255;
  return harm;
}

/**
 * Living crew breathe (use O2, emit CO2 on their tile) and take environmental harm. At 0 hp they
 * are downed and bleed out unless a rescuer stabilizes them in a bed, where they heal and
 * eventually get up. A downed crew whose air is still lethal keeps bleeding even in a bed.
 * Crew without a Health component are ignored. Species flags: `airless` bodies neither breathe nor mind thin air, CO2 or
 * cold, and starve at zero hunger (a slow harm); `mechanical` ones never regenerate (crew mend them); `wreck` ones are wrecked at 0 hp instead of going down; `creature` ones die at 0 hp.
 */
export function vitalsSystem(sim: Sim): void {
  // Best medicine level per ship and side, worked out only when a patient in a bed needs it (rare), once per tick.
  const medics = new Map<string, number>();
  const medicine = (ship: number, side: string): number => {
    const key = `${ship}:${side}`;
    let best = medics.get(key);
    if (best === undefined) {
      best = 0;
      for (const c of sim.world.query(CrewC, PositionC)) {
        if (sim.world.has(c, DeadC) || sim.world.has(c, DownedC) || sim.world.get(c, AllegianceC)?.faction !== side) continue;
        if (shipIdOf(sim, sim.world.get(c, PositionC) as Position) === ship) best = Math.max(best, skillOf(sim, c, 'medicine'));
      }
      medics.set(key, best);
    }
    return best;
  };
  for (const id of sim.world.query(CrewC, HealthC, PositionC)) {
    if (sim.world.has(id, DeadC)) continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const grid = shipGrid(sim, shipIdOf(sim, pos));
    if (!grid?.has('o2') || !grid.inBounds(pos.x, pos.y)) continue;
    const health = sim.world.get(id, HealthC) as Health;
    const downed = sim.world.get(id, DownedC);

    const species = sim.content.species[(sim.world.get(id, CrewC) as Crew).species];
    const airless = !!species?.airless;
    const suited = hasSuitAir(sim, id); // a suit with air in its tank breathes for the wearer; an empty one is as good as none
    if (!suited && !airless) {
      grid.set('o2', pos.x, pos.y, Math.max(0, grid.get('o2', pos.x, pos.y) - BREATH_O2_PER_SEC / TICK_HZ));
      grid.set('co2', pos.x, pos.y, grid.get('co2', pos.x, pos.y) + BREATH_CO2_PER_SEC / TICK_HZ);
    }

    const harm = harmPerSec(grid, pos.x, pos.y, suited, airless) + ((sim.world.get(id, NeedsC)?.hunger ?? 1) <= 0 ? STARVE_HARM_PER_SEC : 0);
    if (!downed) {
      if (health.hp <= 0) {
        // Already at 0 (combat damage): go down without regenerating first.
      } else if (harm > 0) health.hp = Math.max(0, health.hp - harm / TICK_HZ);
      else if (!species?.mechanical) health.hp = Math.min(health.max, health.hp + REGEN_PER_SEC / TICK_HZ);
      if (health.hp <= 0) {
        if (species?.wreck) wreck(sim, id);
        else if (species?.creature) killCrew(sim, id); // creatures die outright (the corpse stays)
        else down(sim, id, pos);
      }
    } else if (downed.stabilized && harm < BED_HEAL_PER_SEC) {
      const care = 1 + SKILL_STEP * medicine(shipIdOf(sim, pos), sim.world.get(id, AllegianceC)?.faction ?? '');
      health.hp = Math.min(health.max, health.hp + (BED_HEAL_PER_SEC * care - harm) / TICK_HZ);
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
  abortTask(sim, id, 'downed');
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

/** A robot body at 0 hp: dead at once, leaving a wreck to salvage (no surrender, no bleeding out). */
function wreck(sim: Sim, id: number): void {
  killCrew(sim, id);
  sim.world.add(id, WreckC, { tick: sim.tick });
  sim.events.emit({ type: 'robot.wrecked', crew: id });
}

function die(sim: Sim, id: number, downed: Downed): void {
  releaseBed(sim, downed.bed, id);
  killCrew(sim, id);
}
