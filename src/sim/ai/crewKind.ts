import { isLodger, onStationRoll, roleOf } from '../consent/roles';
import { speciesOf } from '../robots/core';
import type { Sim } from '../sim';
import type { CrewKind } from './types';
import { isPlayers } from '../side';

/** Apart from ai/utility.ts so that crew schedules can ask it without importing the utility engine (#553). */

/** Which kind of crew member this is, for picking a policy. */
export function crewKind(sim: Sim, id: number): CrewKind {
  if (speciesOf(sim, id)?.charge) return 'robot';
  const role = roleOf(sim, id);
  if (onStationRoll(role)) return 'station';
  if (isLodger(role)) return 'guest';
  return isPlayers(sim, id) ? 'colonist' : 'npc';
}
