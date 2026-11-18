import { policyOf } from '../ai/utility';
import type { Sim } from '../sim';
import { FREE_WAKE_REST } from '../tuning';
import { NeedsC } from './components';
import { onCall } from './onCall';
import { blockAt } from './schedule';

/** When a sleeper with a schedule gets up (#412). Apart from crew/onCall.ts because it asks the crew member's policy (ai/utility.ts), which reads `blockNow` (#553). */

/**
 * True if a sleeper with a plan gets up now. On call (an emergency, a fight) they get up unless exhausted (rest under the sleep drive's need
 * line, `sleepLine`: they sleep on, as before schedules). Into Free (ONI rule) they get up once rest is at least FREE_WAKE_REST; into Work
 * or Any they sleep on until full, as the needs system has it.
 */
export function wakesFromSleep(sim: Sim, id: number): boolean {
  const rest = sim.world.get(id, NeedsC)?.rest ?? 0;
  const b = blockAt(sim, id);
  if (b === 'any') return false;
  if (b === 'free' && rest >= FREE_WAKE_REST) return true;
  return rest >= sleepLine(sim, id) && onCall(sim, id);
}

/** The rest under which the crew member's sleep drive wants them asleep whatever the hour (its entry line; 0 with no such drive). */
function sleepLine(sim: Sim, id: number): number {
  const enter = policyOf(sim, id).drives.find((d) => d.task === 'sleep')?.enter;
  return enter === undefined ? 0 : enter / 10; // drive inputs read in tenths
}
