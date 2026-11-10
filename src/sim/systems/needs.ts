import { isLodger, onStationRoll, roleOf } from '../consent/roles';
import { endSleep, inBed } from '../ai/machines/sleep';
import { dropMeal, finishMeal } from '../ai/machines/eat';
import { CrewC, DraftedC, NeedsC, type Crew, type Needs } from '../crew/components';
import { mealOf } from '../ai/task';
import { noteMeal } from '../crew/mood';
import { isIncapacitated } from '../crew/helpers';
import { FighterC } from '../fight/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { stat } from '../stats';
import { hungerDrainPerSec } from '../crew/eating';
import { BED_REST_MULT, SLEEP_REST_MULT } from '../tuning';
import { holdsSleep } from '../crew/schedule';

/**
 * Rest decays while awake and recovers while sleeping (BED_REST_MULT times faster again when
 * lying in the bed the crew member reserved); sleepers wake at 100 and give the bed back, unless their Sleep block holds them in bed (#412). Hunger decays (half as fast
 * asleep) and meals finish here (see `hunger`). Species with a battery
 * (SpeciesDef.charge) drain Needs.charge instead, busyMult times faster while working or fighting.
 */
export function needsSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, NeedsC)) {
    const crew = sim.world.get(id, CrewC);
    const needs = sim.world.get(id, NeedsC);
    if (!crew || !needs) continue;
    if (isIncapacitated(sim, id)) continue;
    const battery = sim.content.species[crew.species]?.charge;
    if (battery) {
      // Robots: the battery drains (faster while busy) instead of rest; robot bays recharge it.
      if (crew.activity === 'charging') continue;
      const busy = crew.activity === 'working' || (sim.world.get(id, FighterC)?.mode ?? 'idle') !== 'idle';
      needs.charge = Math.max(0, (needs.charge ?? 100) - (battery.drainPerSec * (busy ? battery.busyMult : 1)) / TICK_HZ);
      continue;
    }
    hunger(sim, id, crew, needs);
    const perTick = stat(sim, id, 'restDecay') / TICK_HZ;
    if (crew.activity === 'sleeping') {
      needs.rest = Math.min(100, needs.rest + perTick * SLEEP_REST_MULT * (inBed(sim, id) ? BED_REST_MULT : 1));
      if (needs.rest >= 100 && !holdsSleep(sim, id)) endSleep(sim, id, crew);
    } else {
      needs.rest = Math.max(0, needs.rest - perTick);
    }
  }
}

/**
 * Hunger for species that have it, on the player's side: decays, and a meal in progress counts down and feeds the crew
 * member when it ends. A meal that was interrupted (drafted, fighting, downed) is dropped. Hitting zero raises
 * `crew.starving` once; the harm is dealt by the vitals system.
 */
/** Lowest hunger a station crew member falls to: hungry enough to go and eat, never starving. */
const STATION_HUNGER_FLOOR = 25;

function hunger(sim: Sim, id: number, crew: Crew, needs: Needs): void {
  const def = sim.content.species[crew.species]?.hunger;
  // Station crew get hungry and eat too, but never starve: the station is resupplied off-screen (STATION_HUNGER_FLOOR).
  const role = roleOf(sim, id);
  const station = onStationRoll(role);
  if (!def || (!station && role !== 'crew' && !isLodger(role))) return; // a lodging guest (passenger) eats aboard
  needs.hunger ??= 70 + (crew.appearanceSeed % 31);
  const meal = mealOf(sim, id)?.bb;
  const left = meal?.n ?? -1;
  if (meal && (sim.world.has(id, DraftedC) || (left >= 0 && crew.activity !== 'eating'))) dropMeal(sim, id);
  else if (meal && left >= 0 && (meal.n = left - 1) <= 0) {
    const item = meal.item ?? '', galley = !!meal.hot;
    needs.hunger = Math.min(100, needs.hunger + (sim.content.items[item]?.food?.nutrition ?? 0));
    finishMeal(sim, id);
    noteMeal(sim, id, galley, item);
    sim.events.emit({ type: 'crew.ate', crew: id, item, galley });
  }
  const before = needs.hunger;
  needs.hunger = Math.max(station ? STATION_HUNGER_FLOOR : 0, before - hungerDrainPerSec(sim, id, crew.activity === 'sleeping') / TICK_HZ);
  if (before > 0 && needs.hunger <= 0) sim.events.emit({ type: 'crew.starving', crew: id });
}
