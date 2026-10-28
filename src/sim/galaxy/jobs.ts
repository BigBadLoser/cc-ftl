import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { bumpStat } from '../story/goals';
import { CRATE, crateOf, loadCrate, recoverCrate, unloadCrate } from './crate';
import { addNotoriety, tallyLosses } from './heat';
import { handoverOf, startHandover } from './handover';
import { offersHere } from './jobOffers';
import { atWarContent } from './relations';
import { portsAt } from './portIndex';
import { stationClass } from './ports';
import { repKey, tierOf } from './standing';
import { nodeState } from './state';
import { planStarRoute } from './route';
import { ShipC } from '../combat/components';
import { BREACH_NOTORIETY, JOB_FAIL_REPUTATION, JOB_LOG_MAX, JOB_REPUTATION, MAX_JOBS, RIVAL_REPUTATION } from './tuningJobs';
import type { StationJob } from './types';

/**
 * Taking, doing and failing station jobs (tuningJobs.ts, offers in jobOffers.ts). Commands: `jobs.accept` (an offer at the player's node), `jobs.abandon`,
 * `jobs.openCrate` and `jobs.handIn`.
 * A delivery's goods come aboard as one sealed crate (`CRATE`, crate.ts) set on deck beside the hold, apart from storage: haulers leave it be.
 * The galaxy system calls `tendJobs` while the player is at a node:
 * - a delivery at its destination with the crate aboard asks the station for its shuttle (handover.ts: crew haul the crate to the airlock, the shuttle takes
 *   it, and the delivery is paid then); where no shuttle can come it is handed across by hand at once;
 * - a bounty whose target the player destroys or takes (`tallyLosses` hands their ids over; the target ship carries the job id), and a survey whose node the
 *   player enters, are completed: the job leaves the task list and waits as a claim (`GalaxyState.claims`, no expiry) until `jobs.handIn` at a station of
 *   the issuing type (`StationJob.station`) owned by the issuing faction pays it.
 * `expireJobs` fails what ran out of time, once a turn (claims never expire).
 */

export { CRATE };

/** Whether a delivery's crate is aboard the player's ship, in hyperspace too (then it is packed in the ship's packet), or on its way out with the station shuttle. */
export function crateAboard(sim: Sim, jobId: number): boolean {
  const packet = sim.sector.state === 'hyperspace' ? sim.sector.packet : null;
  if (packet) return packet.entities.some((e) => (e.c['itemStack'] as { job?: number } | undefined)?.job === jobId);
  return crateOf(sim, jobId) !== undefined || handoverOf(sim, jobId) !== undefined;
}

const reject = (sim: Sim, command: string, reason: string): false => (sim.events.emit({ type: 'command.rejected', command, reason }), false);

function standing(sim: Sim, faction: string, delta: number): void {
  const key = repKey(sim, faction);
  sim.story.reputation[key] = reputationOf(sim.story, key) + delta;
}

/** Pirate factions at war with `target` (other than `issuer`) think better of the player: they took a rival down. */
function rivalsPleased(sim: Sim, target: string, issuer: string): void {
  const content = sim.content.galaxy;
  if (!content) return;
  for (const id of Object.keys(content.factions).sort()) {
    if (id !== target && id !== issuer && content.factions[id]?.kind === 'pirates' && atWarContent(content, id, target)) standing(sim, id, RIVAL_REPUTATION);
  }
}

function remember(sim: Sim, key: string): void {
  const log = sim.galaxy.jobLog;
  log.push(key);
  if (log.length > JOB_LOG_MAX) log.splice(0, log.length - JOB_LOG_MAX);
}

/**
 * `jobs.accept`: take an offer at the player's node. A delivery's crate is set on deck (refused with no free floor for it); the job's destination is
 * marked discovered on the starmap along with the nodes of the cheapest route to it.
 */
export function acceptJob(sim: Sim, key: string): boolean {
  const g = sim.galaxy;
  if (sim.sector.state !== 'active' || g.event) return reject(sim, 'jobs.accept', 'notHere');
  if (g.jobs.length >= MAX_JOBS) return reject(sim, 'jobs.accept', 'tooMany');
  const offer = offersHere(sim).find((o) => o.key === key);
  if (!offer) return reject(sim, 'jobs.accept', 'noOffer');
  const job: StationJob = { ...offer, id: g.nextJob };
  if (job.kind === 'delivery' && !loadCrate(sim, job.id)) return reject(sim, 'jobs.accept', 'noRoom');
  g.nextJob++;
  // The bounty's target waits at its node (never entered yet, so its contacts become ships when the player first drops in).
  if (job.kind === 'bounty' && job.node && job.shipgen && job.targetFaction) {
    nodeState(sim, job.node).contacts.push({
      id: g.nextId++, faction: job.targetFaction, shipgen: job.shipgen, seed: job.seed ?? 0, depth: job.depth ?? 1, since: 0, name: job.target, bounty: job.id,
    });
  }
  g.jobs.push(job);
  remember(sim, key);
  bumpStat(sim, 'jobsTaken');
  // The issuer says where: the destination (or the target's node) goes on the player's map, with the cheapest way there, so the
  // starmap can plot the whole trip (the planner only routes through discovered nodes) instead of showing a lone dot out of sensor range.
  const where = job.kind === 'delivery' ? job.to : job.node; // a survey's node too
  if (where) {
    for (const n of planStarRoute(g, g.current, where, { known: false })?.path ?? [where]) g.discovered[n] ??= sim.tick;
  }
  g.rev++;
  sim.events.emit({ type: 'job.accepted', id: job.id, kind: job.kind, issuer: job.issuer });
  return true;
}

/** Pay a finished job: credits, standing with the issuer and the stats the goals read. */
function pay(sim: Sim, job: StationJob): void {
  sim.trade.credits += job.reward;
  bumpStat(sim, 'jobsDone');
  if (job.kind === 'bounty') bumpStat(sim, 'bountiesDone');
  if (job.kind === 'survey') bumpStat(sim, 'surveysDone');
  standing(sim, job.issuer, JOB_REPUTATION);
  // A bounty on one pirate faction pleases the pirate factions at war with it (never the issuer twice).
  if (job.kind === 'bounty' && job.targetFaction) rivalsPleased(sim, job.targetFaction, job.issuer);
}

/**
 * Close a job: paid and thanked ('done': a delivery handed over, or a claim handed in), or failed (with the cost of a broken contract).
 * `via`: how a delivery's crate changed hands ('shuttle' when the station shuttle took it).
 */
function close(sim: Sim, job: StationJob, outcome: 'done' | 'failed' | 'abandoned', via: 'shuttle' | 'instant' = 'instant'): void {
  const g = sim.galaxy;
  g.jobs = g.jobs.filter((j) => j.id !== job.id);
  g.claims = g.claims.filter((j) => j.id !== job.id);
  // A crate handed over leaves the ship; one not delivered is broken open, its goods kept (a breach of contract).
  if (job.kind === 'delivery') unloadCrate(sim, job, outcome !== 'done');
  if (outcome === 'done') {
    pay(sim, job);
    if (job.kind === 'delivery') sim.events.emit({ type: 'job.handedOver', id: job.id, issuer: job.issuer, reward: job.reward, via });
  } else {
    standing(sim, job.issuer, -JOB_FAIL_REPUTATION);
    if (job.kind === 'delivery') addNotoriety(sim, BREACH_NOTORIETY, job.issuer);
  }
  g.rev++;
  sim.events.emit({ type: 'job.closed', id: job.id, kind: job.kind, outcome, reward: outcome === 'done' ? job.reward : 0 });
}

/** A bounty's target is down or a survey's node entered: the job leaves the task list and waits as a claim to hand in (no payment yet). */
function complete(sim: Sim, job: StationJob): void {
  const g = sim.galaxy;
  g.jobs = g.jobs.filter((j) => j.id !== job.id);
  g.claims.push({ ...job });
  g.rev++;
  sim.events.emit({ type: 'job.completed', id: job.id, kind: job.kind as 'bounty' | 'survey', issuer: job.issuer, reward: job.reward });
}

/** The port at the player's node that takes a claim in, or undefined: the issuing station type, owned by the issuing faction, not hostile to the player. */
export function handInPort(sim: Sim, claim: StationJob): string | undefined {
  if (sim.sector.state !== 'active' || sim.galaxy.event) return undefined;
  return portsAt(sim, sim.galaxy.current).find((p) => stationClass(p) === claim.station && p.owner === claim.issuer && tierOf(sim, p.owner) !== 'hostile')?.id;
}

/** `jobs.handIn`: collect a finished bounty or survey at a station of the issuing type and faction. Pays through the normal credit path. */
export function handIn(sim: Sim, id: number): boolean {
  const claim = sim.galaxy.claims.find((j) => j.id === id);
  if (!claim) return reject(sim, 'jobs.handIn', 'noClaim');
  const port = handInPort(sim, claim);
  if (!port) return reject(sim, 'jobs.handIn', 'notHere');
  close(sim, claim, 'done');
  sim.events.emit({ type: 'job.handedIn', id: claim.id, kind: claim.kind as 'bounty' | 'survey', issuer: claim.issuer, reward: claim.reward, port });
  return true;
}

/** `jobs.openCrate`: break a delivery's crate open where it lies (the player must be at a node, with the crate aboard). The delivery fails. */
export function openCrate(sim: Sim, id: number): boolean {
  const job = sim.galaxy.jobs.find((j) => j.id === id && j.kind === 'delivery');
  if (!job) return reject(sim, 'jobs.openCrate', 'noJob');
  if (sim.sector.state !== 'active' || crateOf(sim, id) === undefined) return reject(sim, 'jobs.openCrate', 'notAboard');
  close(sim, job, 'failed');
  return true;
}

/** `jobs.abandon`. */
export function abandonJob(sim: Sim, id: number): boolean {
  const job = sim.galaxy.jobs.find((j) => j.id === id);
  if (!job) return reject(sim, 'jobs.abandon', 'noJob');
  close(sim, job, 'abandoned');
  return true;
}

/**
 * Keep the jobs up to date while the player is at a node (or in an event grid): `destroyed` are the ships the player just destroyed or took (heat.ts
 * `tallyLosses`). A bounty whose target is among them is completed (a claim), and so is a survey whose node the player is at; a delivery at its destination
 * with the crate aboard is handed over (handover.ts), and paid once the station shuttle has the crate.
 */
export function tendJobs(sim: Sim, destroyed: readonly number[]): void {
  const g = sim.galaxy;
  const hits = new Set(destroyed.map((id) => sim.world.get(id, ShipC)?.bounty).filter((b): b is number => b !== undefined));
  for (const job of [...g.jobs]) {
    if (job.kind === 'bounty') {
      if (hits.has(job.id)) complete(sim, job);
    } else if (job.kind === 'survey') {
      // Entering the node is enough for now; a scanner module requirement comes later (issue #178 follow-up).
      if (job.node === g.current && sim.sector.state !== 'hyperspace' && !g.event) complete(sim, job);
    } else if (job.collected) {
      close(sim, job, 'done', 'shuttle');
    } else if (!g.event && sim.sector.state === 'active' && job.to === g.current && recoverCrate(sim, job.id)) {
      if (startHandover(sim, job) === 'instant') close(sim, job, 'done', 'instant');
    }
  }
}

/**
 * Count the player's kills and takes (heat.ts) and settle the jobs that hang on them. The galaxy system calls it every second; leaving a node (a jump, leaving
 * an event grid) calls it first too, before the node is archived, so a target destroyed just before the jump still counts.
 */
export function settleLosses(sim: Sim): void {
  tendJobs(sim, tallyLosses(sim));
}

/** Fail the jobs whose time ran out. Once a turn. */
export function expireJobs(sim: Sim, turn: number): void {
  for (const job of [...sim.galaxy.jobs]) if (turn > job.due && !job.collected) close(sim, job, 'failed');
}
