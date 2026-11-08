import { abortTask } from '../ai/task';
import { lodgingHere } from '../consent/guests';
import { dropPassenger } from '../consent/passage';
import { releaseBedOwner } from '../crew/beds';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { firePersonFact } from '../scene/carried';
import type { Sim } from '../sim';
import { playerShip } from '../trade/player';
import { AboardC, VehicleC } from '../vehicles/components';
import { nodesWithin } from './graph';
import { hash32 } from './hash';
import { portsAt } from './portIndex';
import { tierOf } from './standing';
import { PASSAGE_BASE, PASSAGE_HOPS, PASSAGE_PER_HOP, PASSAGE_TURNS_BASE, PASSAGE_TURNS_PER_HOP } from './tuningJobs';
import type { StationJob } from './types';

/**
 * Passage (DESIGN.md "Medical pod", decision 7; #173). A passenger who wants to go somewhere posts a passage card (`GalaxyState.posted`): a station job of
 * kind 'passage' naming them (`crew`), to a port of their own faction within PASSAGE_HOPS jumps, the fare by distance and a due turn. The trip lives on the
 * job, never on the person. The player accepts it (`jobs.accept`: it becomes one of their jobs) or refuses it (`jobs.refuse`: the card stays, refused, and
 * the passenger gets off at the next port the ship is at, no fare). At the destination the job's handover (handover.ts) takes them off the ship as it takes
 * a delivery's crate, the recruit run reversed: they walk into the station's shuttle (or the player's flies them over), and the fare is paid. A passage
 * failed (past due, abandoned, the passenger dead) is any broken contract (jobs.ts `close`); a living passenger then gets off at the next port.
 */

const SALT = 0x9a55;
/** The ports a passenger can be set down at. */
export const PORT_KINDS: ReadonlySet<string> = new Set(['station', 'depot', 'den']);

/** The posted passage cards (asked or refused). Read only: `post` adds one (the list is made with the first, so saves without passengers keep their shape). */
export const postedCards = (sim: Sim): readonly StationJob[] => sim.galaxy.posted ?? [];
const post = (sim: Sim, card: StationJob): void => void (sim.galaxy.posted ??= []).push(card);

/** The passage card or job that names the person, if any. */
export const passageOf = (sim: Sim, crew: number): StationJob | undefined =>
  sim.galaxy.jobs.find((j) => j.kind === 'passage' && j.crew === crew) ?? postedCards(sim).find((j) => j.crew === crew);

/** True while the person is alive and aboard the player's ship as a passenger (on deck or in one of its shuttles). */
export function passengerAboard(sim: Sim, crew: number): boolean {
  if (!sim.world.has(crew, CrewC) || sim.world.has(crew, DeadC)) return false;
  if (sim.world.has(crew, PositionC)) return lodgingHere(sim, crew)?.by === 'passage';
  return sim.world.has(crew, AboardC);
}

/** Where the person wants to go: a port of `origin` within PASSAGE_HOPS jumps (not hostile to the player), picked from the seed; null when there is none. */
function destination(sim: Sim, crew: number, origin: string): { node: string; hops: number } | null {
  const g = sim.galaxy;
  if (tierOf(sim, origin) === 'hostile') return null;
  const out: { node: string; hops: number }[] = [];
  for (const [node, hops] of nodesWithin(sim, g.current, PASSAGE_HOPS)) {
    if (hops >= 1 && portsAt(sim, node).some((p) => PORT_KINDS.has(p.kind) && p.owner === origin)) out.push({ node, hops });
  }
  if (!out.length) return null;
  out.sort((a, b) => (a.node < b.node ? -1 : 1));
  return out[hash32(sim.seed, SALT, crew) % out.length] ?? null;
}

/** The person (a passenger, from `origin`) asks for passage: a card is posted, once. With nowhere of theirs in reach it is refused at once: they get off at the next port. */
export function postPassage(sim: Sim, crew: number, origin: string): void {
  const g = sim.galaxy;
  if (passageOf(sim, crew) || !passengerAboard(sim, crew)) return;
  const d = destination(sim, crew, origin);
  const card: StationJob = {
    id: g.nextJob++, key: `passage:${crew}`, kind: 'passage', issuer: origin, from: g.current, crew, reward: 0, due: g.turn,
    ...(d ? { to: d.node, reward: PASSAGE_BASE + PASSAGE_PER_HOP * d.hops, due: g.turn + PASSAGE_TURNS_BASE + PASSAGE_TURNS_PER_HOP * d.hops } : { refused: true as const }),
  };
  post(sim, card);
  g.rev++;
  sim.events.emit({ type: 'job.posted', id: card.id, crew, name: sim.world.get(crew, CrewC)?.name ?? '', to: card.to ?? '', reward: card.reward });
}

/** `jobs.refuse`: turn a passage card down. The passenger gets off at the next port. */
export function refusePassage(sim: Sim, key: string): boolean {
  const card = postedCards(sim).find((j) => j.key === key && !j.refused);
  if (!card) {
    sim.events.emit({ type: 'command.rejected', command: 'jobs.refuse', reason: 'noOffer' });
    return false;
  }
  card.refused = true;
  sim.galaxy.rev++;
  return true;
}

/** Take an asked card off the board (`jobs.accept` makes it a job). */
export function takeCard(sim: Sim, key: string): StationJob | undefined {
  const cards = postedCards(sim);
  const card = cards.find((j) => j.key === key && !j.refused);
  if (card) sim.galaxy.posted = cards.filter((j) => j !== card);
  return card;
}

/** A passage that failed with the passenger still aboard: they get off at the next port instead (no fare). */
export function strand(sim: Sim, job: StationJob): void {
  if (job.crew === undefined || !passengerAboard(sim, job.crew)) return;
  const card: StationJob = { ...job, reward: 0, refused: true };
  delete card.collected;
  delete card.handoverTries;
  delete card.ownTries;
  post(sim, card);
}

/**
 * The passenger leaves the ship: handed over at their destination (`delivered`: the event's person rules fire it first) or set down at a port. Their
 * passage grant goes and they leave play (wherever they stood: on deck, or aboard the shuttle that took them).
 */
export function passengerOff(sim: Sim, crew: number, delivered: boolean): void {
  if (delivered) firePersonFact(sim, crew, 'delivered');
  dropPassenger(sim, playerShip(sim), crew);
  const aboard = sim.world.get(crew, AboardC)?.vehicle;
  const v = aboard === undefined ? undefined : sim.world.get(aboard, VehicleC);
  if (v) {
    v.passengers = v.passengers.filter((c) => c !== crew);
    if (v.pilot === crew) v.pilot = 0;
  }
  if (!sim.world.has(crew, CrewC)) return;
  abortTask(sim, crew, 'removed');
  releaseBedOwner(sim, crew);
  sim.world.destroyEntity(crew);
}
