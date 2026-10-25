import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { giveItems, takeItems } from '../story/effects';
import { playerStock } from '../story/world';
import { addNotoriety } from './heat';
import { offersHere } from './jobOffers';
import { repKey } from './standing';
import { nodeState } from './state';
import { ShipC } from '../combat/components';
import { BREACH_NOTORIETY, JOB_FAIL_REPUTATION, JOB_LOG_MAX, JOB_REPUTATION, MAX_JOBS } from './tuningJobs';
import type { StationJob } from './types';

/**
 * Taking, doing and failing station jobs (tuningJobs.ts, offers in jobOffers.ts). Commands: `jobs.accept` (an offer at the player's node) and `jobs.abandon`.
 * The galaxy system calls `tendJobs` while the player is at a node: a delivery is handed over on arrival with the goods aboard; a bounty is paid when the player
 * destroys or takes its target (`tallyLosses` hands their ids over; the target ship carries the job id). `expireJobs` fails what ran out of time, once a turn.
 */

const reject = (sim: Sim, command: string, reason: string): false => (sim.events.emit({ type: 'command.rejected', command, reason }), false);

function standing(sim: Sim, faction: string, delta: number): void {
  const key = repKey(sim, faction);
  sim.story.reputation[key] = reputationOf(sim.story, key) + delta;
}

function remember(sim: Sim, key: string): void {
  const log = sim.galaxy.jobLog;
  log.push(key);
  if (log.length > JOB_LOG_MAX) log.splice(0, log.length - JOB_LOG_MAX);
}

/** `jobs.accept`: take an offer at the player's node. A delivery's goods go into the player's storage (what does not fit lands on the floor beside it). */
export function acceptJob(sim: Sim, key: string): boolean {
  const g = sim.galaxy;
  if (sim.sector.state !== 'active' || g.event) return reject(sim, 'jobs.accept', 'notHere');
  if (g.jobs.length >= MAX_JOBS) return reject(sim, 'jobs.accept', 'tooMany');
  const offer = offersHere(sim).find((o) => o.key === key);
  if (!offer) return reject(sim, 'jobs.accept', 'noOffer');
  const job: StationJob = { ...offer, id: g.nextJob++ };
  if (job.kind === 'delivery' && job.item && job.count) giveItems(sim, job.item, job.count);
  // The bounty's target waits at its node (never entered yet, so its contacts become ships when the player first drops in).
  if (job.kind === 'bounty' && job.node && job.shipgen && job.targetFaction) {
    nodeState(sim, job.node).contacts.push({
      id: g.nextId++, faction: job.targetFaction, shipgen: job.shipgen, seed: job.seed ?? 0, depth: job.depth ?? 1, since: 0, name: job.target, bounty: job.id,
    });
  }
  g.jobs.push(job);
  remember(sim, key);
  g.rev++;
  sim.events.emit({ type: 'job.accepted', id: job.id, kind: job.kind, issuer: job.issuer });
  return true;
}

/** Close a job: paid and thanked, or failed (with the cost of a broken contract). */
function close(sim: Sim, job: StationJob, outcome: 'done' | 'failed' | 'abandoned'): void {
  const g = sim.galaxy;
  g.jobs = g.jobs.filter((j) => j.id !== job.id);
  if (outcome === 'done') {
    sim.trade.credits += job.reward;
    standing(sim, job.issuer, JOB_REPUTATION);
  } else {
    standing(sim, job.issuer, -JOB_FAIL_REPUTATION);
    if (job.kind === 'delivery') addNotoriety(sim, BREACH_NOTORIETY, job.issuer);
  }
  g.rev++;
  sim.events.emit({ type: 'job.closed', id: job.id, kind: job.kind, outcome, reward: outcome === 'done' ? job.reward : 0 });
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
 * `tallyLosses`). A bounty whose target is among them is paid; a delivery at its destination with the goods aboard is handed over.
 */
export function tendJobs(sim: Sim, destroyed: readonly number[]): void {
  const g = sim.galaxy;
  const hits = new Set(destroyed.map((id) => sim.world.get(id, ShipC)?.bounty).filter((b): b is number => b !== undefined));
  for (const job of [...g.jobs]) {
    if (job.kind === 'bounty') {
      if (hits.has(job.id)) close(sim, job, 'done');
    } else if (!g.event && sim.sector.state === 'active' && job.to === g.current && job.item && job.count && playerStock(sim, job.item) >= job.count) {
      takeItems(sim, job.item, job.count);
      close(sim, job, 'done');
    }
  }
}

/** Fail the jobs whose time ran out. Once a turn. */
export function expireJobs(sim: Sim, turn: number): void {
  for (const job of [...sim.galaxy.jobs]) if (turn > job.due) close(sim, job, 'failed');
}
