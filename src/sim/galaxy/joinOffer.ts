import { ConsentC, type Carry } from '../consent/components';
import { dropPassenger } from '../consent/passage';
import { CrewC, MoodC, PrioritiesC } from '../crew/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { becomeCrew } from '../trade/recruitLand';
import { playerShip } from '../trade/player';
import { unit } from './hash';
import type { StationJob } from './types';

/**
 * A passenger asks to join the crew (DESIGN.md "Medical pod", decision 8; #173). Once per person, at one of two moments: while aboard, once their mood has
 * stayed above JOIN_MOOD for JOIN_HAPPY_SEC (one seeded roll, JOIN_CHANCE), or on delivery, before the handover at their port, if their mood is above it then. The ask waits for the player
 * (an urgent alert: `jobs.join`), at most JOIN_WAIT_SEC (then it is a no). Yes makes them crew with their own skills (the recruit run's `becomeCrew`), their
 * passage closed with neither fare nor penalty. No keeps the passage as it was. The state of it is on their passage grant (`Grant.carry`).
 */

export const JOIN_MOOD = 60;
export const JOIN_HAPPY_SEC = 300;
export const JOIN_CHANCE = 0.4;
export const JOIN_WAIT_SEC = 120;
const SALT = 0x701e;

/** The carried record of a passenger on the player's ship, if any. */
export function carryOf(sim: Sim, crew: number): Carry | undefined {
  return sim.world.get(playerShip(sim), ConsentC)?.grants.find((g) => g.by === 'passage' && g.crew?.includes(crew))?.carry;
}

function ask(sim: Sim, crew: number, c: Carry): void {
  c.asked = true;
  c.asking = sim.tick;
  sim.events.emit({ type: 'crew.asksToJoin', crew, name: sim.world.get(crew, CrewC)?.name ?? '' });
}

/** The one condition for asking, aboard or at delivery: their mood is above JOIN_MOOD now. */
const happy = (sim: Sim, crew: number): boolean => (sim.world.get(crew, MoodC)?.value ?? 0) > JOIN_MOOD;

/** Once a second for each carried person aboard (scene/carried.ts): their mood, the roll, and an ask left unanswered too long (a no). */
export function considerJoining(sim: Sim, crew: number, c: Carry): void {
  if (c.asking !== undefined) {
    if (sim.tick - c.asking >= JOIN_WAIT_SEC * TICK_HZ) answerJoin(sim, crew, false);
    return;
  }
  if (c.asked || c.rolled) return;
  if (!happy(sim, crew)) {
    delete c.happySince;
    return;
  }
  c.happySince ??= sim.tick;
  if (sim.tick - c.happySince < JOIN_HAPPY_SEC * TICK_HZ) return;
  c.rolled = true;
  if (unit(sim.seed, SALT, crew) < JOIN_CHANCE) ask(sim, crew, c);
}

/**
 * At the passage's destination, before the handover: true while the passenger's ask holds it (asked now, the first time and only if they are happy, as
 * aboard; or still waiting for an answer).
 */
export function holdForJoin(sim: Sim, job: StationJob): boolean {
  const c = job.crew === undefined ? undefined : carryOf(sim, job.crew);
  if (!c || job.crew === undefined) return false;
  if (!c.asked && happy(sim, job.crew)) ask(sim, job.crew, c);
  return c.asking !== undefined;
}

/** `jobs.join`: answer a passenger's ask. Yes: they are crew now; no: nothing changes. False when nobody asked. */
export function answerJoin(sim: Sim, crew: number, accept: boolean): boolean {
  const c = carryOf(sim, crew);
  if (c?.asking === undefined) {
    sim.events.emit({ type: 'command.rejected', command: 'jobs.join', reason: 'notAsking' });
    return false;
  }
  delete c.asking;
  if (!accept) {
    sim.events.emit({ type: 'crew.joinDeclined', crew });
    return true;
  }
  const g = sim.galaxy;
  // The passage ends with them (neither fare nor broken contract): they are not going anywhere now.
  g.jobs = g.jobs.filter((j) => !(j.kind === 'passage' && j.crew === crew));
  if (g.posted) g.posted = g.posted.filter((j) => j.crew !== crew);
  dropPassenger(sim, playerShip(sim), crew);
  becomeCrew(sim, crew);
  const role = sim.content.roles[sim.world.get(crew, CrewC)?.role ?? ''];
  if (role) sim.world.add(crew, PrioritiesC, { ...role.priorities });
  sim.events.emit({ type: 'crew.joined', crew, name: sim.world.get(crew, CrewC)?.name ?? '' });
  return true;
}

/** The passengers aboard the player's ship whose ask to join waits for an answer, ascending (the alerts are built from it, saved state, not the event). */
export function pendingAsks(sim: Sim): number[] {
  const grants = sim.world.get(playerShip(sim), ConsentC)?.grants ?? [];
  return grants.filter((g) => g.by === 'passage' && g.carry?.asking !== undefined).flatMap((g) => g.crew ?? []).sort((a, b) => a - b);
}

/** True while the passenger's ask waits for an answer. */
export const askingToJoin = (sim: Sim, crew: number): boolean => carryOf(sim, crew)?.asking !== undefined;
