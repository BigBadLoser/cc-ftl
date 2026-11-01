import type { Sim } from '../sim';
import { loadCrate } from './crate';
import { nodesWithin } from './graph';
import { teleport } from './hyperspace';
import { portsAt } from './portIndex';
import { stationClass } from './ports';
import { tierOf } from './standing';
import type { StationJob } from './types';

/**
 * Debug set-ups for playtesting station jobs (`debug.jobScenario`, used by `?scenario=handover|bounty|survey`):
 * - 'handover': a delivery for the player's current node with its crate on deck (the start node has a trade station), due in 20 turns;
 * - 'bounty' / 'survey': a finished claim of the nearest military / research station (the player is taken there; the caller deploys), ready to hand in.
 */
export function jobScenario(sim: Sim, name: 'handover' | 'bounty' | 'survey'): boolean {
  const g = sim.galaxy;
  const fail = (reason: string): false => (sim.events.emit({ type: 'command.rejected', command: 'debug.jobScenario', reason }), false);
  const base = { id: g.nextJob, key: `debug|${g.nextJob}`, reward: 400, due: g.turn + 20 };
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
