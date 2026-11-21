import { shipIdOf, shipGrid } from '../regions';
import { abortTask } from '../ai/task';
import { releaseBed } from '../crew/beds';
import {
  CrewC, DeadC, DownedC, DraftedC, HealthC, NeedsC, PositionC, RecoveringC,
  type Crew, type Downed, type Health, type Position,
} from '../crew/components';
import { killCrew } from '../crew/death';
import { tileHarmParts } from '../crew/hazard';
import { healMult, isBleeding, mustBeDown, vitalLost } from '../crew/body';
import { damageCrew, injureOnDown } from '../crew/injure';
import { hasSuitAir } from '../eva/suit';
import { WreckC } from '../robots/components';
import { AboardC, VehicleC, type Vehicle } from '../vehicles/components';
import { occupants } from '../vehicles/lifecycle';
import type { Sim } from '../sim';
import { bleedOutSec } from '../crew/traits';
import { TICK_HZ } from '../time';
import {
  BED_HEAL_PER_SEC, BREATH_CO2_PER_SEC, BREATH_O2_PER_SEC, GET_UP_HP, REGEN_PER_SEC, STARVE_HARM_PER_SEC, XP_PER_HP_HEALED,
} from '../tuning';
import { careHealStep, leaveCare, podModule, restInCare, startRecovery } from '../crew/recovery';
import { tendingOf, treatmentMult } from '../crew/treatment';
import { grantXp } from '../crew/xp';

/**
 * Living crew breathe (use O2, emit CO2 on their tile) and take environmental harm. At 0 hp they
 * are downed and bleed out unless a rescuer stabilizes them in a bed, where they heal and
 * eventually get up. A downed crew whose air is still lethal keeps bleeding even in a bed. Injuries (crew/body.ts) can knock a crew member out
 * whatever their hp, keep them down in bed, and a lost vital organ bleeds them out; a bleeding wound stops their regeneration; blood pumping scales healing.
 * Crew aboard a vehicle (no tile: `AboardC`) keep their vitals too (`vitalsAboard`): the cabin is pressurised, so air and the tile fields do not reach
 * them, but hunger harms, a wound bleeds and they can go down or die in flight.
 * Crew without a Health component are ignored. Species flags: `airless` bodies neither breathe nor mind thin air, CO2 or
 * cold, and starve at zero hunger (a slow harm); `mechanical` ones never regenerate (crew mend them); `wreck` ones are wrecked at 0 hp instead of going down; `creature` ones die at 0 hp.
 */
export function vitalsSystem(sim: Sim): void {
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

    const parts = tileHarmParts(grid, pos.x, pos.y, suited, airless);
    const starve = (sim.world.get(id, NeedsC)?.hunger ?? 1) <= 0 ? STARVE_HARM_PER_SEC : 0;
    const harm = parts.air + parts.temp + parts.fire + starve;
    let resting = sim.world.get(id, RecoveringC);
    if (resting && (health.hp <= 0 || mustBeDown(sim, id))) {
      leaveCare(sim, id, resting); // a wound in bed that downs them (a lost vital organ): out of the bed, and down below
      resting = undefined;
    }
    if (resting) {
      restInCare(sim, id, resting, health, harm); // a recovery pod: heals to full, out of action meanwhile
    } else if (!downed) {
      if (health.hp <= 0) {
        // Already at 0 (combat damage): go down without regenerating first.
      } else if (harm > 0) {
        // Through the one damage owner: thin air and fire add up to injuries (crew/injure.ts), heat, cold and hunger only take hp.
        damageCrew(sim, id, parts.air / TICK_HZ, 'vacuum', { dose: true });
        damageCrew(sim, id, parts.fire / TICK_HZ, 'fire', { dose: true });
        damageCrew(sim, id, (parts.temp + starve) / TICK_HZ, null);
      } else if (!species?.mechanical && !isBleeding(sim, id)) health.hp = Math.min(health.max, health.hp + (REGEN_PER_SEC * healMult(sim, id)) / TICK_HZ);
      if (health.hp <= 0 || mustBeDown(sim, id)) {
        if (species?.wreck) wreck(sim, id);
        else if (species?.creature) killCrew(sim, id); // creatures die outright (the corpse stays)
        else down(sim, id, pos);
      }
    } else if (downed.stabilized && !vitalLost(sim, id) && harm < BED_HEAL_PER_SEC && podModule(sim, downed.bed)) {
      // Carried to a recovery pod: no medic needed; at GET_UP_HP they stay on as a pod patient to full (crew/recovery.ts). Knocked out, they stay down.
      if (careHealStep(sim, id, downed, health, harm) && health.hp >= GET_UP_HP && !mustBeDown(sim, id)) startRecovery(sim, id, downed);
    } else if (downed.stabilized && !vitalLost(sim, id) && harm < BED_HEAL_PER_SEC) {
      // Heals at the bed rate, faster while a medic tends a medical bed (crew/treatment.ts `tendingOf`: the one answer; the XP goes to the tender).
      const ship = shipIdOf(sim, pos);
      const tend = tendingOf(sim, downed.bed);
      const care = tend.mult * treatmentMult(sim, ship, downed);
      const before = health.hp;
      health.hp = Math.min(health.max, health.hp + (BED_HEAL_PER_SEC * care * healMult(sim, id) - harm) / TICK_HZ);
      if (tend.medic && health.hp > before) grantXp(sim, tend.medic, 'medicine', (health.hp - before) * XP_PER_HP_HEALED);
      if (health.hp >= GET_UP_HP && !mustBeDown(sim, id)) getUp(sim, id, downed); // knocked out (crew/body.ts), they stay down until it heals
    } else {
      damageCrew(sim, id, harm / TICK_HZ, null);
      // First aid stops the bleeding, not a fire or empty air; a lost vital organ bleeds them out even in a bed (only surgery could save them).
      if (!downed.patched || harm > 0 || vitalLost(sim, id)) downed.bleed -= 1 / TICK_HZ;
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
    if (harm > 0) damageCrew(sim, id, harm / TICK_HZ, null);
    else if (health.hp > 0 && !species?.mechanical && !isBleeding(sim, id)) health.hp = Math.min(health.max, health.hp + (REGEN_PER_SEC * healMult(sim, id)) / TICK_HZ);
    if (health.hp > 0 && !mustBeDown(sim, id)) return;
    if (species?.wreck) wreck(sim, id);
    else if (species?.creature) killCrew(sim, id);
    else down(sim, id, null);
    return;
  }
  damageCrew(sim, id, harm / TICK_HZ, null);
  if (!downed.patched || harm > 0 || vitalLost(sim, id)) downed.bleed -= 1 / TICK_HZ;
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
  injureOnDown(sim, id); // going down always adds a serious injury (it can shorten the bleed-out: a hurt heart)
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
