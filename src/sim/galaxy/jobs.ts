import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { ItemStackC } from '../items/components';
import { spillItems, takeFromStack } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { shipIdAt, shipIdOf } from '../regions';
import { playerShips, playerStorages } from '../story/world';
import { playerShip } from '../trade/player';
import { addNotoriety, tallyLosses } from './heat';
import { offersHere } from './jobOffers';
import { repKey } from './standing';
import { nodeState } from './state';
import { ShipC } from '../combat/components';
import { BREACH_NOTORIETY, JOB_FAIL_REPUTATION, JOB_LOG_MAX, JOB_REPUTATION, MAX_JOBS } from './tuningJobs';
import type { StationJob } from './types';

/**
 * Taking, doing and failing station jobs (tuningJobs.ts, offers in jobOffers.ts). Commands: `jobs.accept` (an offer at the player's node) and `jobs.abandon`.
 * A delivery's goods come aboard as one sealed crate (`CRATE`, ItemStack.job) set on deck beside the hold, apart from storage: haulers leave it be.
 * The galaxy system calls `tendJobs` while the player is at a node: a delivery is handed over on arrival with its crate aboard; a bounty is paid when the player
 * destroys or takes its target (`tallyLosses` hands their ids over; the target ship carries the job id). `expireJobs` fails what ran out of time, once a turn.
 */

/** The item id of a delivery crate (content items, `cargo`). */
export const CRATE = 'item.cargo_crate';

/** The loose stack holding a delivery's crate on a player ship, or undefined (lost, or not aboard). */
export function crateOf(sim: Sim, jobId: number): number | undefined {
  const ships = playerShips(sim);
  return sim.world.query(ItemStackC).find((id) => {
    const s = sim.world.get(id, ItemStackC);
    return s?.job === jobId && ships.has(shipIdAt(sim, s.x, s.y));
  });
}

/** Whether a delivery's crate is aboard the player's ship, in hyperspace too (then it is packed in the ship's packet). */
export function crateAboard(sim: Sim, jobId: number): boolean {
  const packet = sim.sector.state === 'hyperspace' ? sim.sector.packet : null;
  if (packet) return packet.entities.some((e) => (e.c['itemStack'] as { job?: number } | undefined)?.job === jobId);
  return crateOf(sim, jobId) !== undefined;
}

/** Set a delivery's crate on deck beside the player's first hold (else beside any module). False when there is no free floor near it. */
function loadCrate(sim: Sim, jobId: number): boolean {
  const ship = playerShip(sim);
  const at = [...playerStorages(sim), ...sim.world.query(ModuleC)].map((id) => sim.world.get(id, ModuleC)).find((m) => m && shipIdOf(sim, m) === ship);
  return !!at && spillItems(sim, ship, at.x, at.y, CRATE, 1, jobId) === 0;
}

/** Hand a crate over (`open` false: it leaves the ship) or break it open (its goods spill out where it stood: kept). */
function unloadCrate(sim: Sim, job: StationJob, open: boolean): void {
  const id = crateOf(sim, job.id);
  if (id === undefined) return;
  const { x, y } = sim.world.get(id, ItemStackC)!;
  const ship = shipIdAt(sim, x, y);
  takeFromStack(sim, id, 1);
  if (open && job.item && job.count) spillItems(sim, ship, x, y, job.item, job.count);
}

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

/**
 * `jobs.accept`: take an offer at the player's node. A delivery's crate is set on deck (refused with no free floor for it); the job's destination is
 * marked discovered on the starmap.
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
  // The issuer says where: the destination (or the target's node) goes on the player's map.
  const where = job.kind === 'delivery' ? job.to : job.node;
  if (where) g.discovered[where] ??= sim.tick;
  g.rev++;
  sim.events.emit({ type: 'job.accepted', id: job.id, kind: job.kind, issuer: job.issuer });
  return true;
}

/** Close a job: paid and thanked, or failed (with the cost of a broken contract). */
function close(sim: Sim, job: StationJob, outcome: 'done' | 'failed' | 'abandoned'): void {
  const g = sim.galaxy;
  g.jobs = g.jobs.filter((j) => j.id !== job.id);
  // A crate handed over leaves the ship; one not delivered is broken open, its goods kept (a breach of contract).
  if (job.kind === 'delivery') unloadCrate(sim, job, outcome !== 'done');
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
    } else if (!g.event && sim.sector.state === 'active' && job.to === g.current && crateOf(sim, job.id) !== undefined) {
      close(sim, job, 'done');
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
  for (const job of [...sim.galaxy.jobs]) if (turn > job.due) close(sim, job, 'failed');
}
