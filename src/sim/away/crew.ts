import { BodyC } from '../body';
import { shipById } from '../combat/ships';
import { flightTicks, walkSpeed } from '../ai/travel';
import { CrewC, DeadC, HealthC, NeedsC, PositionC, PrioritiesC, type Job } from '../crew/components';
import { TICK_HZ } from '../time';
import { AboardC, VehicleC } from '../vehicles/components';
import { boardingTile } from '../vehicles/geometry';
import { vehicleFaction } from '../vehicles/lifecycle';
import { hatchSpot } from '../eva/shuttle';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { isIncapacitated } from '../crew/helpers';
import { hungerDrainPerSec } from '../crew/eating';
import { stat } from '../stats';
import { blockNow, secToSleep } from '../crew/schedule';
import {
  AWAY_GO_STAY_SEC, AWAY_HOME_CHARGE, AWAY_HOME_HEALTH, AWAY_HOME_HUNGER, AWAY_HOME_REST, AWAY_URGENT_CHARGE, AWAY_URGENT_HUNGER, AWAY_URGENT_REST,
} from '../tuning';
import { AwayC, AwaySiteC, SiteRunC } from './components';
import { fightCalls } from './phase';
import { siteDemand } from './seats';

/**
 * The crew side of away sites (docs/DESIGN.md "Away sites", #286 slice 2a): who may take a passage, and the return drive's input. No site
 * code moves crew about except the closing lift; the crew AI does (the return machine, ai/machines/return.ts).
 */

/** The living crew of the player's side standing on the ship, ascending id. */
export function playerCrewOnShip(sim: Sim, ship: number): number[] {
  return [...sim.world.query(CrewC, PositionC)].filter((id) => !sim.world.has(id, DeadC) && sim.world.get(id, AllegianceC)?.faction === 'player' && shipIdOf(sim, sim.world.get(id, PositionC)!) === ship).sort((a, b) => a - b);
}

/** True while a living crew member of the player's side stands on the ship (a site's wreck must not go while anyone is on it). */
export function playerCrewOn(sim: Sim, ship: number): boolean {
  return playerCrewOnShip(sim, ship).length > 0;
}

/** The site a crew member is working on: they are of its party and stand on its grid. 0 otherwise. */
export function siteUnderFoot(sim: Sim, id: number): number {
  const away = sim.world.get(id, AwayC);
  const pos = away && sim.world.get(id, PositionC);
  return pos && shipIdOf(sim, pos) === away.site ? away.site : 0;
}

/** The crew member a site's shuttle is fetching (a pickup it answered, `AwayC.pickup`): lowest id of its party out. 0 for none. */
export function fetching(sim: Sim, vehicle: number): number {
  let first = 0;
  for (const c of sim.world.query(AwayC, CrewC)) {
    const away = sim.world.get(c, AwayC)!;
    if (away.vehicle === vehicle && away.pickup && (!first || c < first) && !sim.world.has(c, AboardC) && !sim.world.has(c, DeadC)) first = c;
  }
  return first;
}

/**
 * Where a shuttle takes people aboard on a grid: the hatch spot while it hovers beside it (they float in), or the inside tile of the
 * airlock it is docked at (they step in). Null when it is neither. On a pickup the shuttle hovers beside the crew member it fetches, so
 * their own tile is the hatch spot (the hull near them may be all but gone: they float in from where they stand).
 */
export function siteSpot(sim: Sim, vehicle: number, shipId: number): { x: number; y: number; docked: boolean } | null {
  const v = sim.world.get(vehicle, VehicleC);
  const at = sim.world.get(fetching(sim, vehicle), PositionC);
  const spot = v?.state === 'docked' ? boardingTile(sim, vehicle) : hatchSpot(sim, vehicle, at && shipIdOf(sim, at) === v?.hover ? at : undefined);
  return spot && spot.shipId === shipId ? { x: spot.x, y: spot.y, docked: v?.state === 'docked' } : null;
}

/** True if the party of this site is being called home: the site closes, is gone, or a fight started. */
export function siteRecalled(sim: Sim, site: number): boolean {
  const s = sim.world.get(site, AwaySiteC);
  const run = s && sim.world.get(s.vehicle, SiteRunC);
  return !s || s.status === 'closing' || !run || run.phase === 'recall' || fightCalls(sim, site);
}

/**
 * True if any need the crew member has (rest, hunger, a battery's charge; 0..100) is under its line. A need they lack is satisfied: the same
 * rule serves crew who eat and sleep and robots who charge.
 */
function needBelow(sim: Sim, id: number, rest: number, hunger: number, charge: number): boolean {
  const n = sim.world.get(id, NeedsC);
  return !!n && (n.rest < rest || (n.hunger ?? 100) < hunger || (n.charge ?? 100) < charge);
}

/** True if the crew member is hurt enough to go home at once (below AWAY_HOME_HEALTH, or downed). */
function hurt(sim: Sim, id: number): boolean {
  const h = sim.world.get(id, HealthC);
  return isIncapacitated(sim, id) || (!!h && h.max > 0 && h.hp < AWAY_HOME_HEALTH * h.max);
}

/**
 * The return drive's input (`awayReturn`): absent unless the crew member works on their site. 0 when they must come aboard now (the site
 * is closing, a fight, hurt below AWAY_HOME_HEALTH, riding out a round trip, or a pickup came for them), 500 when they are due home (a need
 * under its home line, AWAY_HOME_REST / _HUNGER / _CHARGE: before the sleep, eat or charge drives would want them; or their schedule has them
 * in a Sleep block, #412), else 1000.
 */
export function awayReturn(sim: Sim, id: number): number | undefined {
  const site = siteUnderFoot(sim, id);
  if (!site) return undefined;
  const away = sim.world.get(id, AwayC);
  if (siteRecalled(sim, site) || away?.ride || away?.pickup || away?.recall || hurt(sim, id)) return 0;
  const plan = scheduleHome(sim, id);
  const beside = (): boolean => ['stay', 'depart'].includes(sim.world.get(away?.vehicle ?? 0, SiteRunC)?.phase ?? '');
  return needBelow(sim, id, AWAY_HOME_REST, AWAY_HOME_HUNGER, AWAY_HOME_CHARGE) || plan === 'sleep' || (plan === 'free' && beside()) ? 500 : 1000;
}

/**
 * Whether a party member's schedule sends them home (#412, user decisions 2026-11-10): 'sleep' in their Sleep block (due home, and a trip
 * with them aboard leaves at once, `passengerUrgent`), 'free' in their Free time (they work on at the site while its shuttle is away, as
 * `blockNow` reads Free as Work there, and come aboard once it is beside the site; a trip with them aboard is due, `tripDue`). Null otherwise.
 */
export function scheduleHome(sim: Sim, id: number): 'sleep' | 'free' | null {
  const b = blockNow(sim, id, false);
  return b === 'sleep' || b === 'free' ? b : null;
}

/**
 * True if a passenger waiting aboard for the next trip home is urgent (the trip leaves at once): hurt or downed, a need under its urgent
 * line (AWAY_URGENT_*: where they would sleep, eat or charge; needs keep running aboard), or their Sleep block started (#412), so nobody
 * sleeps or starves in a seat.
 */
export function passengerUrgent(sim: Sim, id: number): boolean {
  return !!sim.world.get(id, AwayC)?.recall || hurt(sim, id) || needBelow(sim, id, AWAY_URGENT_REST, AWAY_URGENT_HUNGER, AWAY_URGENT_CHARGE) ||
    scheduleHome(sim, id) === 'sleep';
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

/** Per need, seconds of work before it falls to its home line (`staySec` is the least of them). Infinity for a need they lack. */
function needSecs(sim: Sim, id: number): { rest: number; hunger: number; charge: number } {
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

/**
 * The need that keeps a crew member from a passage (`staySec` under AWAY_GO_STAY_SEC): the one that falls to its home line first, rest or
 * hunger. Null when they may go, or when only a battery's charge keeps them (a robot charges on its own drive).
 */
export function needKeepsHome(sim: Sim, id: number): 'rest' | 'hunger' | null {
  const t = needSecs(sim, id);
  if (Math.min(t.rest, t.hunger, t.charge) >= AWAY_GO_STAY_SEC) return null;
  if (t.hunger < AWAY_GO_STAY_SEC && t.hunger <= t.rest) return 'hunger';
  return t.rest < AWAY_GO_STAY_SEC ? 'rest' : t.hunger < AWAY_GO_STAY_SEC ? 'hunger' : null;
}

/**
 * The need a crew member sees to early, before an away trip (#408; one answer with the schedule, #412): on duty by their schedule (a Work or
 * Any block: in Free and Sleep they take no passage), a site on `ship` wants workers they would be (a trip there worth making before their
 * Sleep block, `tripWorthIt`), and a need is too low to stay out a while (`needKeepsHome`). Null otherwise.
 */
export function needBeforeTrip(sim: Sim, id: number, ship: number): 'rest' | 'hunger' | null {
  const block = blockNow(sim, id);
  if (block === 'sleep' || block === 'free') return null;
  const need = needKeepsHome(sim, id);
  return need && siteWantsThem(sim, id, ship) ? need : null;
}

/**
 * True if an away site of the crew member's side wants workers from the ship they stand on (open, not called in, the general party: no named
 * party and no standing by), a trip there is worth making before their Sleep block (`tripWorthIt`) and some work it waits on is in a category they take.
 */
export function siteWantsThem(sim: Sim, id: number, ship: number): boolean {
  if (sim.world.has(id, AwayC)) return false;
  for (const site of sim.world.query(AwaySiteC)) {
    const s = sim.world.get(site, AwaySiteC)!;
    const v = sim.world.get(s.vehicle, VehicleC);
    if (!v || v.homeShip !== ship || s.status !== 'open' || s.invited || s.standBy || fightCalls(sim, site) || !ofSide(sim, id, s.vehicle)) continue;
    if (tripWorthIt(sim, id, s.vehicle, site) && takesSiteWork(sim, id, site)) return true;
  }
  return false;
}

/** True if the crew member takes some of the work a site waits on: a priority set for a category it has demand in. */
export function takesSiteWork(sim: Sim, id: number, site: number): boolean {
  const prio = sim.world.get(id, PrioritiesC);
  return !!prio && Object.entries(siteDemand(sim, site)).some(([cat, n]) => (n ?? 0) > 0 && (prio[cat as keyof typeof prio] ?? 0) >= 1);
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
