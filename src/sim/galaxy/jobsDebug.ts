import type { Sim } from '../sim';
import { crateOf, loadCrate } from './crate';
import { takeFromStack } from '../items/stacks';
import { nodesWithin } from './graph';
import { teleport } from './hyperspace';
import { portsAt } from './portIndex';
import { stationClass } from './ports';
import { tierOf } from './standing';
import type { StationJob } from './types';
import { acceptJob } from './jobs';
import { offersHere } from './jobOffers';

/**
 * Debug set-ups for playtesting station jobs (`debug.jobScenario`, used by `?scenario=handover|bounty|survey|tracker`):
 * - 'handover': a delivery for the player's current node with its crate on deck (the start node has a trade station), due in 20 turns;
 * - 'tracker': the jobs tracker full for screenshots: the 'handover' delivery here, the station's offers taken up to the cap, the last one due
 *   in 2 turns and one with its crate gone;
 * - 'bounty' / 'survey': a finished claim of the nearest military / research station (the player is taken there; the caller deploys), ready to hand in.
 */
export function jobScenario(sim: Sim, name: 'handover' | 'bounty' | 'survey' | 'tracker'): boolean {
  const g = sim.galaxy;
  const fail = (reason: string): false => (sim.events.emit({ type: 'command.rejected', command: 'debug.jobScenario', reason }), false);
  const base = { id: g.nextJob, key: `debug|${g.nextJob}`, reward: 400, due: g.turn + 20 };
  if (name === 'tracker') {
    if (!jobScenario(sim, 'handover')) return false;
    for (const o of offersHere(sim)) if (!acceptJob(sim, o.key)) break;
    const away = g.jobs.filter((j) => j.to !== g.current);
    const last = away[away.length - 1];
    if (last) last.due = g.turn + 2;
    const lost = away.length > 1 ? away[0] : undefined;
    const crate = lost && crateOf(sim, lost.id);
    if (crate !== undefined) takeFromStack(sim, crate, 1);
    g.rev++;
    return true;
  }
  if (name === 'handover') {
    const port = portsAt(sim, g.current).find((p) => stationClass(p) === 'trade');
    if (!port) return fail('noStation');
    const job: StationJob = { ...base, kind: 'delivery', issuer: port.owner, from: port.id, station: 'trade', to: g.current, item: 'item.parts', count: 8 };
    if (!loadCrate(sim, job.id)) return fail('noRoom');
    g.nextJob++;
    g.jobs.push(job);
    g.rev++;
    return true;
  }
  const cls = name === 'bounty' ? 'military' : 'research';
  let best: { node: string; owner: string; id: string; hops: number } | undefined;
  for (const [node, hops] of nodesWithin(sim, g.current, 8)) {
    const port = portsAt(sim, node).find((p) => stationClass(p) === cls && tierOf(sim, p.owner) !== 'hostile');
    if (port && (!best || hops < best.hops)) best = { node, owner: port.owner, id: port.id, hops };
  }
  if (!best) return fail('noStation');
  const claim: StationJob = name === 'bounty'
    ? { ...base, kind: 'bounty', issuer: best.owner, from: best.id, station: cls, target: 'Grey Wake', targetFaction: best.owner, node: best.node }
    : { ...base, kind: 'survey', issuer: best.owner, from: best.id, station: cls, node: best.node, feature: 'nebula' };
  g.nextJob++;
  g.claims.push(claim);
  if (best.node !== g.current) teleport(sim, best.node);
  g.rev++;
  return true;
}
