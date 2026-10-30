import { EatC, NeedsC } from '../crew/components';
import { wantsToEat } from '../crew/eating';
import { wantsBay } from '../robots/bay';
import { speciesOf } from '../robots/core';
import { heldForMend } from '../robots/jobs';
import type { Sim } from '../sim';
import { OPERATOR_EXHAUSTED_BELOW } from '../tuning';
import { IntentC } from './components';
import { SLEEP_BELOW } from './machines/sleep';
import { isCarrying } from './task';
import type { DriveId } from './types';

/**
 * `policy.legacy` (docs/CREW_AI.md section 8, Phase 1): `decide`'s thresholds verbatim, as drive flags. A robot heads for its bay
 * when `wantsBay`; anyone sleeps below rest 20 (an operator at its post only when exhausted); a hungry one eats (operators only
 * when it is urgent); a rescuer carrying a patient wants none of these. The drives are tried in this order and each may fall
 * through (no bay, no food), exactly as `decide` did; work is always wanted. Phase 3 replaces it with the data-driven engine.
 */
export const LEGACY_POLICY = 'policy.legacy';
/** The drive order of `Intent.scores`. */
export const LEGACY_DRIVES: readonly DriveId[] = ['recharge', 'sleep', 'eat', 'work'];

/** What policy.legacy wants this tick. */
export interface LegacyWants {
  /** A robot a mender has come for: hold still (an interrupt in the design; the legacy check stays inline). */
  mendHold: boolean;
  recharge: boolean;
  sleep: boolean;
  eat: boolean;
}

const ON = 1000;

/**
 * Evaluate policy.legacy for a crew member and write their `Intent`. `operating`: they hold a console. Whether they carry a patient
 * is only looked up when some drive wants them (as `decide` did): it is the rare case.
 */
export function legacyIntent(sim: Sim, id: number, operating: boolean): LegacyWants {
  const rest = (sim.world.get(id, NeedsC) as { rest: number }).rest;
  // Only a mechanical body is ever mended (mend jobs are posted for robots alone): skip the job scan for everyone else.
  const mend = !!speciesOf(sim, id)?.mechanical && heldForMend(sim, id);
  const bay = wantsBay(sim, id);
  const tired = rest < (operating ? OPERATOR_EXHAUSTED_BELOW : SLEEP_BELOW);
  const hungry = sim.world.has(id, EatC) || wantsToEat(sim, id, operating);
  const free = !((mend || bay || tired || hungry) && isCarrying(sim, id));
  const w: LegacyWants = { mendHold: mend && free, recharge: bay && free, sleep: tired && free, eat: hungry && free };
  writeIntent(sim, id, w);
  return w;
}

function writeIntent(sim: Sim, id: number, w: LegacyWants): void {
  const drive: DriveId = w.recharge ? 'recharge' : w.sleep ? 'sleep' : w.eat ? 'eat' : 'work';
  const intent = sim.world.get(id, IntentC);
  if (!intent) {
    sim.world.add(id, IntentC, { policy: LEGACY_POLICY, drive, since: sim.tick, scores: [w.recharge ? ON : 0, w.sleep ? ON : 0, w.eat ? ON : 0, ON], nextEval: sim.tick + 1 });
    return;
  }
  intent.nextEval = sim.tick + 1;
  if (intent.drive === drive && drive === 'work' && intent.scores[0] === 0 && intent.scores[1] === 0 && intent.scores[2] === 0) return; // the usual case: unchanged
  if (intent.drive !== drive) {
    intent.drive = drive;
    intent.since = sim.tick;
  }
  const s = intent.scores;
  s[0] = w.recharge ? ON : 0;
  s[1] = w.sleep ? ON : 0;
  s[2] = w.eat ? ON : 0;
  s[3] = ON;
}
