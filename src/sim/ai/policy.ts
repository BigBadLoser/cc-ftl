import { EatC, NeedsC } from '../crew/components';
import { wantsToEat } from '../crew/eating';
import { wantsBay } from '../robots/bay';
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
  /** Carrying a patient: no drive pulls them off the rescue. */
  carrying: boolean;
  /** A robot a mender has come for: hold still (an interrupt in the design; the legacy check stays inline). */
  mendHold: boolean;
  recharge: boolean;
  sleep: boolean;
  eat: boolean;
}

const ON = 1000;

/** Evaluate policy.legacy for a crew member and write their `Intent`. `operating`: they hold a console. */
export function legacyIntent(sim: Sim, id: number, operating: boolean): LegacyWants {
  const carrying = isCarrying(sim, id);
  const rest = (sim.world.get(id, NeedsC) as { rest: number }).rest;
  const w: LegacyWants = {
    carrying,
    mendHold: !carrying && heldForMend(sim, id),
    recharge: !carrying && wantsBay(sim, id),
    sleep: !carrying && rest < (operating ? OPERATOR_EXHAUSTED_BELOW : SLEEP_BELOW),
    eat: !carrying && (sim.world.has(id, EatC) || wantsToEat(sim, id, operating)),
  };
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
  if (intent.drive !== drive) {
    intent.drive = drive;
    intent.since = sim.tick;
  }
  const s = intent.scores;
  s[0] = w.recharge ? ON : 0;
  s[1] = w.sleep ? ON : 0;
  s[2] = w.eat ? ON : 0;
  s[3] = ON;
  intent.nextEval = sim.tick + 1;
}
