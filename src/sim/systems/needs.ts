import { releaseBedClaim } from '../crew/beds';
import { BedClaimC, CrewC, DraftedC, EatC, NeedsC, PositionC, type Crew, type Needs } from '../crew/components';
import { noteMeal, noteSleep } from '../crew/mood';
import { AllegianceC } from '../fight/components';
import { isIncapacitated } from '../crew/helpers';
import { FighterC } from '../fight/components';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { stat } from '../stats';
import { BED_REST_MULT, HUNGER_SLEEP_MULT } from '../tuning';
import { StationCrewC } from '../stations/components';

/** Sleeping recovers this many times faster than awake decay. */
const SLEEP_RECOVERY_MULT = 5;

/**
 * Rest decays while awake and recovers while sleeping (BED_REST_MULT times faster again when
 * lying in the bed the crew member reserved); sleepers wake at 100 and give the bed back. Hunger decays (half as fast
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
      const bed = inBed(sim, id);
      needs.rest = Math.min(100, needs.rest + perTick * SLEEP_RECOVERY_MULT * (bed ? BED_REST_MULT : 1));
      if (needs.rest >= 100) {
        noteSleep(sim, id, bed);
        releaseBedClaim(sim, id);
        crew.activity = 'idle';
        sim.events.emit({ type: 'crew.wokeUp', crew: id });
      }
    } else {
      needs.rest = Math.max(0, needs.rest - perTick);
    }
  }
}

/** True if the crew member is on the tile of the bed they reserved. */
function inBed(sim: Sim, id: number): boolean {
  const claim = sim.world.get(id, BedClaimC);
  const bed = claim && sim.world.get(claim.bed, ModuleC);
  const pos = sim.world.get(id, PositionC);
  return !!bed && !!pos && pos.x === bed.x && pos.y === bed.y;
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
  const station = sim.world.has(id, StationCrewC);
  if (!def || (!station && sim.world.get(id, AllegianceC)?.faction !== 'player')) return;
  needs.hunger ??= 70 + (crew.appearanceSeed % 31);
  const eat = sim.world.get(id, EatC);
  if (eat && (sim.world.has(id, DraftedC) || (eat.left >= 0 && crew.activity !== 'eating'))) sim.world.remove(id, EatC);
  else if (eat && eat.left >= 0 && --eat.left <= 0) {
    needs.hunger = Math.min(100, needs.hunger + (sim.content.items[eat.item]?.food?.nutrition ?? 0));
    sim.world.remove(id, EatC);
    crew.activity = 'idle';
    noteMeal(sim, id, eat.galley);
    sim.events.emit({ type: 'crew.ate', crew: id, item: eat.item, galley: eat.galley });
  }
  const before = needs.hunger;
  needs.hunger = Math.max(station ? STATION_HUNGER_FLOOR : 0, before - (def.decayPerSec * (crew.activity === 'sleeping' ? HUNGER_SLEEP_MULT : 1)) / TICK_HZ);
  if (before > 0 && needs.hunger <= 0) sim.events.emit({ type: 'crew.starving', crew: id });
}
