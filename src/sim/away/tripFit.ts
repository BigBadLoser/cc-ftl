import { BodyC } from '../body';
import { shipById } from '../combat/shipQuery';
import { flightTicks, walkSpeed } from '../ai/travel';
import { CrewC, NeedsC, type Job } from '../crew/components';
import { hungerDrainPerSec } from '../crew/eating';
import { stat } from '../stats';
import { TICK_HZ } from '../time';
import { VehicleC } from '../vehicles/components';
import { vehicleFaction } from '../vehicles/lifecycle';
import { AllegianceC } from '../fight/components';
import type { Sim } from '../sim';
import { secToSleep } from '../crew/schedule';
import { AWAY_GO_STAY_SEC, AWAY_HOME_CHARGE, AWAY_HOME_HUNGER, AWAY_HOME_REST } from '../tuning';
import { AwayC } from './components';

/**
 * Away trip planning the job scheduler asks (crew/jobFit.ts, ai/jobRank.ts): whose side a shuttle is on, how long a crew member can stay out,
 * whether a trip is worth it before their Sleep block, whether a passage fits them. Apart from away/crew.ts, which asks the block in force
 * (crew/onCall.ts), so the scheduler doesn't import `onCall` back (#553).
 */

/** Per need, seconds of work before it falls to its home line (`staySec` is the least of them). Infinity for a need they lack. */
export function needSecs(sim: Sim, id: number): { rest: number; hunger: number; charge: number } {
  const n = sim.world.get(id, NeedsC);
  if (!n) return { rest: Infinity, hunger: Infinity, charge: Infinity };
  const left = (value: number, line: number, perSec: number): number => (perSec > 0 ? Math.max(0, value - line) / perSec : Infinity);
  const battery = sim.content.species[sim.world.get(id, CrewC)?.species ?? '']?.charge;
  return {
    rest: left(n.rest, AWAY_HOME_REST, stat(sim, id, 'restDecay')),
    hunger: n.hunger === undefined ? Infinity : left(n.hunger, AWAY_HOME_HUNGER, hungerDrainPerSec(sim, id, false)),
    charge: n.charge === undefined || !battery ? Infinity : left(n.charge, AWAY_HOME_CHARGE, battery.drainPerSec * battery.busyMult),
  };
}

/** True if the crew member is of the side of the shuttle (its home ship's): its passages, pickups and seats are theirs. */
export function ofSide(sim: Sim, crew: number, vehicle: number): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  return !!v && sim.world.get(crew, AllegianceC)?.faction === vehicleFaction(sim, v);
}

/**
 * Seconds of work on a site before the first of the crew member's needs falls to its home line (AWAY_HOME_REST / _HUNGER / _CHARGE) at
 * its waking rate (a battery at its busy rate). Infinity for one with no need that drains. Their schedule is `tripWorthIt`'s.
 */
export function staySec(sim: Sim, id: number): number {
  const t = needSecs(sim, id);
  return Math.min(t.rest, t.hunger, t.charge);
}

/**
 * True if a trip to the site is worth making before the crew member's next Sleep block (#412, user decision 2026-11-10): the time they
 * would work there, from landing until Sleep, is longer than the flight there and back. When Sleep comes they take the shuttle home
 * (`awayReturn`, `passengerUrgent`). Always true with no Sleep in their plan.
 */
export function tripWorthIt(sim: Sim, id: number, vehicle: number, site: number): boolean {
  const fly = flightSec(sim, vehicle, site);
  return secToSleep(sim, id) - fly > 2 * fly;
}

/** Seconds the shuttle takes to fly from where it is to the site, one way (0 when either is unknown). */
function flightSec(sim: Sim, vehicle: number, site: number): number {
  const v = sim.world.get(vehicle, VehicleC);
  const body = sim.world.get(vehicle, BodyC);
  const s = shipById(sim, site);
  if (!v || !body || !s) return 0;
  const ticks = flightTicks(sim, v, Math.hypot(s.x + s.width / 2 - body.x, s.y + s.height / 2 - body.y));
  return Number.isFinite(ticks) ? ticks / TICK_HZ : 0;
}

/**
 * The passage checks of `jobFits`: a player crew member not already of a party, rested, fed or charged enough to stay a while (AWAY_GO_STAY_SEC
 * of work before a need sends them home), with a trip worth making before their Sleep block (`tripWorthIt`).
 */
export function passageFits(sim: Sim, crew: number, job: Job): boolean {
  if (job.kind !== 'passage') return true;
  if (job.holder && job.holder !== crew) return false; // a named party's seat (`AwaySite.invited`)
  if (sim.world.has(crew, AwayC) || !ofSide(sim, crew, job.target ?? 0)) return false;
  return sim.world.has(crew, NeedsC) && staySec(sim, crew) >= AWAY_GO_STAY_SEC && tripWorthIt(sim, crew, job.target ?? 0, job.site ?? 0);
}

/**
 * What a passage costs beyond the walk to the bay, in walking tiles of this crew member: the flight to the site. So a home job of the same
 * level and urgency nearby still wins (docs/DESIGN.md "Who goes").
 */
export function passageTiles(sim: Sim, crew: number, job: Job): number {
  if (job.kind !== 'passage') return 0;
  return Math.round(flightSec(sim, job.target ?? 0, job.site ?? 0) * walkSpeed(sim, crew));
}
