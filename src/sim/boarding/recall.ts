import { AwayC } from '../away/components';
import { notRecallable, recallCrew } from '../away/recall';
import type { Sim } from '../sim';
import { cancelSabotage } from './sabotage';

/**
 * `crew.recall` (#287): boarders called home. Their sabotage orders end (`cancelled`); the away site's run brings them aboard and home
 * (away/recall.ts). `crew.recallStarted` names who goes, per shuttle, with those who could not (listed once, on the first);
 * `crew.recallFailed` names those who could not, per reason. Returns a reject reason when nobody could be sent.
 */
export function orderRecall(sim: Sim, ids: readonly number[]): string | null {
  cancelSabotage(sim, ids.filter((c) => notRecallable(sim, c) === null));
  const { sent, left } = recallCrew(sim, ids);
  const byReason = new Map<string, number[]>();
  for (const l of left) byReason.set(l.reason, [...(byReason.get(l.reason) ?? []), l.crew]);
  for (const [reason, crew] of byReason) sim.events.emit({ type: 'crew.recallFailed', vehicle: 0, crew, reason });
  let first = true;
  for (const [vehicle, crew] of [...sent].sort((a, b) => a[0] - b[0])) {
    const ship = sim.world.get(crew[0] as number, AwayC)?.site ?? 0;
    sim.events.emit({ type: 'crew.recallStarted', vehicle, ship, crew: [...crew], left: first ? left : [] });
    first = false;
  }
  return sent.size > 0 ? null : (left[0]?.reason ?? 'noCrew');
}
