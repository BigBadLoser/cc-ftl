import { nodeOf, type Sim } from '../sim';
import { reachFrom } from '../sim/galaxy/graph';
import { offersHere, type JobOffer } from '../sim/galaxy/jobOffers';
import { crateAboard } from '../sim/galaxy/jobs';
import { MAX_JOBS } from '../sim/galaxy/tuningJobs';
import type { StationJob } from '../sim/galaxy/types';
import type { UiJob, UiJobs } from '../ui/api';

/** What a delivery crate on deck is, for the inspector: its job, its contents and destination. Null for any other stack. */
export function crateInfo(sim: Sim, jobId: number | undefined): { job: number; title: string; to: string } | null {
  const j = jobId === undefined ? undefined : sim.galaxy.jobs.find((x) => x.id === jobId);
  if (!j) return null;
  const item = j.item ? sim.content.items[j.item]?.name ?? j.item : '';
  return { job: j.id, title: `${j.count ?? 0}× ${item}`, to: j.to ? nodeOf(sim, j.to)?.name ?? 'uncharted space' : '' };
}

/** The job board as the jobs panel shows it: the offers at the player's node and the jobs they hold. */
export function buildJobs(sim: Sim): UiJobs {
  const g = sim.galaxy;
  const content = sim.content.galaxy;
  const reach = reachFrom(sim, g.current);
  const place = (node: string | undefined) => (node ? nodeOf(sim, node)?.name ?? 'uncharted space' : '');
  const hops = (node: string | undefined) => (node ? reach.dist.get(node) ?? null : null);
  const view = (j: JobOffer | StationJob): UiJob => {
    const where = j.kind === 'delivery' ? j.to : j.node;
    const itemName = j.item ? sim.content.items[j.item]?.name ?? j.item : '';
    return {
      key: j.key, id: 'id' in j ? j.id : null, kind: j.kind, issuer: content?.factions[j.issuer]?.name ?? j.issuer, reward: j.reward,
      turnsLeft: Math.max(0, j.due - g.turn), where: place(where), hops: hops(where), here: where === g.current,
      title: j.kind === 'delivery' ? `Deliver a sealed crate (${j.count ?? 0} ${itemName})` : `Destroy the ${j.target ?? 'target'}`,
      detail: j.kind === 'delivery'
        ? `to ${place(j.to)}`
        : `a ${content?.factions[j.targetFaction ?? '']?.name ?? 'hostile'} ship waiting at ${place(j.node)}`,
      ready: j.kind === 'delivery' && 'id' in j && crateAboard(sim, j.id),
    };
  };
  const canTake = sim.sector.state === 'active' && !g.event;
  return {
    here: canTake ? place(g.current) : null,
    offers: canTake ? offersHere(sim).map(view) : [],
    active: g.jobs.map(view),
    max: MAX_JOBS,
  };
}
