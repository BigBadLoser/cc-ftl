import { shipIdOf, shipGrid } from '../regions';
import { abortTask } from '../ai/task';
import { releaseBed } from '../crew/beds';
import {
  CrewC, DeadC, DownedC, DraftedC, HealthC, NeedsC, PositionC, RecoveringC,
  type Crew, type Downed, type Health, type Position,
} from '../crew/components';
import { killCrew } from '../crew/death';
import { tileHarm } from '../crew/hazard';
import { hasSuitAir } from '../eva/suit';
import { WreckC } from '../robots/components';
import { AboardC, VehicleC, type Vehicle } from '../vehicles/components';
import { occupants } from '../vehicles/lifecycle';
import { guestHere } from '../consent/guests';
import { ShipC } from '../combat/components';
import { skillOf } from '../combat/operators';
import { AllegianceC } from '../fight/components';
import type { Sim } from '../sim';
import { bleedOutSec } from '../crew/traits';
import { TICK_HZ } from '../time';
import {
  BED_HEAL_PER_SEC, BREATH_CO2_PER_SEC, BREATH_O2_PER_SEC, GET_UP_HP, REGEN_PER_SEC, SKILL_STEP, STARVE_HARM_PER_SEC, XP_PER_HP_HEALED,
} from '../tuning';
import { careHealStep, podModule, restInCare, startRecovery } from '../crew/recovery';
import { treatmentMult } from '../crew/treatment';
import { grantXp } from '../crew/xp';

/**
 * Living crew breathe (use O2, emit CO2 on their tile) and take environmental harm. At 0 hp they
 * are downed and bleed out unless a rescuer stabilizes them in a bed, where they heal and
 * eventually get up. A downed crew whose air is still lethal keeps bleeding even in a bed.
 * Crew aboard a vehicle (no tile: `AboardC`) keep their vitals too (`vitalsAboard`): the cabin is pressurised, so air and the tile fields do not reach
 * them, but hunger harms, a wound bleeds and they can go down or die in flight.
 * Crew without a Health component are ignored. Species flags: `airless` bodies neither breathe nor mind thin air, CO2 or
 * cold, and starve at zero hunger (a slow harm); `mechanical` ones never regenerate (crew mend them); `wreck` ones are wrecked at 0 hp instead of going down; `creature` ones die at 0 hp.
 */
export function vitalsSystem(sim: Sim): void {
  // Best medicine level per ship and side, worked out only when a patient in a bed needs it (rare), once per tick.
  const medics = new Map<string, { skill: number; id: number }>();
  const medicine = (ship: number, side: string): { skill: number; id: number } => {
    const key = `${ship}:${side}`;
    let best = medics.get(key);
    if (best === undefined) {
      best = { skill: 0, id: 0 }; // the best medicine wins; ties (all at 0 too) go to the lowest id, the query order
      for (const c of sim.world.query(CrewC, PositionC)) {
        if (sim.world.has(c, DeadC) || sim.world.has(c, DownedC) || sim.world.get(c, AllegianceC)?.faction !== side) continue;
        if (shipIdOf(sim, sim.world.get(c, PositionC) as Position) !== ship) continue;
        const skill = skillOf(sim, c, 'medicine');
        if (best.id === 0 || skill > best.skill || (skill === best.skill && c < best.id)) best = { skill, id: c };
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

    const harm = tileHarm(grid, pos.x, pos.y, suited, airless) + ((sim.world.get(id, NeedsC)?.hunger ?? 1) <= 0 ? STARVE_HARM_PER_SEC : 0);
    const resting = sim.world.get(id, RecoveringC);
    if (resting) {
      restInCare(sim, id, resting, health, harm); // a recovery pod: heals to full, out of action meanwhile
    } else if (!downed) {
      if (health.hp <= 0) {
        // Already at 0 (combat damage): go down without regenerating first.
      } else if (harm > 0) health.hp = Math.max(0, health.hp - harm / TICK_HZ);
      else if (!species?.mechanical) health.hp = Math.min(health.max, health.hp + REGEN_PER_SEC / TICK_HZ);
      if (health.hp <= 0) {
        if (species?.wreck) wreck(sim, id);
        else if (species?.creature) killCrew(sim, id); // creatures die outright (the corpse stays)
        else down(sim, id, pos);
      }
    } else if (downed.stabilized && harm < BED_HEAL_PER_SEC && podModule(sim, downed.bed)) {
      // Carried to a recovery pod: no medic needed; at GET_UP_HP they stay on as a pod patient to full (crew/recovery.ts).
      if (careHealStep(sim, id, downed, health, harm) && health.hp >= GET_UP_HP) startRecovery(sim, id, downed);
    } else if (downed.stabilized && harm < BED_HEAL_PER_SEC) {
      // A guest is cared for by the crew of the ship that took them in (a passenger in the player's bed has the player's medic).
      const ship = shipIdOf(sim, pos);
      const side = guestHere(sim, id) ? sim.world.get(ship, ShipC)?.faction : sim.world.get(id, AllegianceC)?.faction;
      const medic = medicine(ship, side ?? '');
      const care = (1 + SKILL_STEP * Math.max(0, medic.skill)) * treatmentMult(sim, ship, downed);
      const before = health.hp;
      health.hp = Math.min(health.max, health.hp + (BED_HEAL_PER_SEC * care - harm) / TICK_HZ);
      if (medic.id && health.hp > before) grantXp(sim, medic.id, 'medicine', (health.hp - before) * XP_PER_HP_HEALED); // the medic whose skill sped the healing
      if (health.hp >= GET_UP_HP) getUp(sim, id, downed);
    } else {
      health.hp = Math.max(0, health.hp - harm / TICK_HZ);
      if (!downed.patched || harm > 0) downed.bleed -= 1 / TICK_HZ; // first aid stops the bleeding, not a fire or empty air
      if (downed.bleed <= 0) die(sim, id, downed);
    }
  }
  // (Riders are found through the vehicles: querying the aboard store would create it, and an empty store changes the save bytes of games without one.)
  for (const v of sim.world.query(VehicleC)) {
    const veh = sim.world.get(v, VehicleC) as Vehicle;
    for (const id of occupants(veh)) if (sim.world.has(id, HealthC) && sim.world.has(id, AboardC) && !sim.world.has(id, DeadC)) vitalsAboard(sim, id);
  }
}

/** One tick of vitals for someone riding a vehicle: no air or tile harm, only hunger; they regenerate, go down, bleed and die as on a tile. */
function vitalsAboard(sim: Sim, id: number): void {
  const health = sim.world.get(id, HealthC) as Health;
  const downed = sim.world.get(id, DownedC);
  const species = sim.content.species[(sim.world.get(id, CrewC) as Crew).species];
  const harm = (sim.world.get(id, NeedsC)?.hunger ?? 1) <= 0 ? STARVE_HARM_PER_SEC : 0;
  if (!downed) {
    if (harm > 0) health.hp = Math.max(0, health.hp - harm / TICK_HZ);
    else if (health.hp > 0 && !species?.mechanical) health.hp = Math.min(health.max, health.hp + REGEN_PER_SEC / TICK_HZ);
    if (health.hp > 0) return;
    if (species?.wreck) wreck(sim, id);
    else if (species?.creature) killCrew(sim, id);
    else down(sim, id, null);
    return;
  }
  health.hp = Math.max(0, health.hp - harm / TICK_HZ);
  if (!downed.patched || harm > 0) downed.bleed -= 1 / TICK_HZ;
  if (downed.bleed <= 0) die(sim, id, downed);
}

function down(sim: Sim, id: number, pos: Position | null): void {
  const crew = sim.world.get(id, CrewC) as Crew;
  abortTask(sim, id, 'downed');
  sim.world.remove(id, DraftedC);
  if (pos) {
    pos.toX = pos.x;
    pos.toY = pos.y;
    pos.progress = 0;
  }
  sim.world.add(id, DownedC, { bleed: bleedOutSec(sim, id), stabilized: false, bed: 0 });
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
