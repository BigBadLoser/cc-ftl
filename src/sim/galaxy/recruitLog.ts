import type { Sim } from '../sim';
import { RECRUIT_LOG_MAX } from './tuningRecruit';

/** The taken-candidates log (`GalaxyState.recruitLog`), apart from galaxy/recruit.ts so that hiring (trade/recruitLand.ts) doesn't import the station sync (#553). */

/** Note a candidate key as taken (hired, or dead): it is not offered again in its window. The log is capped. */
export function logRecruit(sim: Sim, key: string): void {
  const log = sim.galaxy.recruitLog;
  log.push(key);
  if (log.length > RECRUIT_LOG_MAX) log.splice(0, log.length - RECRUIT_LOG_MAX);
}
