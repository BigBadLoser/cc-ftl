import { INSPECT_BAN_TURNS, INSPECT_BRIBE_CHANCE, INSPECT_REFUSE_HIT, SCAN_STANDING_HIT } from '../blackmarket/tuning';
import type { Command } from '../commands';
import { repKey } from '../galaxy/standing';
import { spillItems } from '../items/stacks';
import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { TraderC } from '../trade/types';
import { VehicleC } from '../vehicles/components';
import { cargoTile } from '../vehicles/geometry';
import { InspectionC, type Inspection } from './types';
import { leave } from './start';

/**
 * Settling an inspection that found contraband (#138): `inspect.settle` while the lead inspector waits ('settle').
 * - 'fine': the fine is paid (all the credits there are, if short), standing with the faction falls by SCAN_STANDING_HIT, and they keep the goods.
 * - 'bribe': refused without the credits. Taken with INSPECT_BRIBE_CHANCE (a seeded roll): it is paid and the goods are handed back (set down by
 *   the shuttle's door for the crew to stow). Turned down: nothing is paid, standing falls by SCAN_STANDING_HIT, and no bribe is offered again.
 * - 'refuse': nothing is paid; they leave with what they took, standing falls by INSPECT_REFUSE_HIT and the station refuses service for INSPECT_BAN_TURNS galaxy turns (`Trader.barredUntil`).
 *   (Fighting them is a later step: #138 step 3.)
 */

const hit = (sim: Sim, faction: string, n: number): void => {
  const key = repKey(sim, faction);
  sim.story.reputation[key] = reputationOf(sim.story, key) - n;
};

/** What refusing (or running from) an inspection costs: a standing hit, and the station's service. */
export function refuseConsequences(sim: Sim, insp: Inspection): void {
  hit(sim, insp.faction, INSPECT_REFUSE_HIT);
  const t = sim.world.get(insp.station, TraderC);
  if (t) t.barredUntil = sim.galaxy.turn + INSPECT_BAN_TURNS;
}

/** Set the seized goods down on the player's ship by the shuttle's door (a bribe taken). */
function handBack(sim: Sim, vehicle: number, insp: Inspection): void {
  const v = sim.world.get(vehicle, VehicleC);
  const at = cargoTile(sim, vehicle);
  if (!v || !at || at.shipId !== insp.ship) return;
  for (const q of v.cargo) spillItems(sim, insp.ship, at.x, at.y, q.item, q.count);
  v.cargo = [];
}

const reject = (sim: Sim, command: string, reason: string): void => sim.events.emit({ type: 'command.rejected', command, reason });

export const inspectHandlers: { 'inspect.settle': (sim: Sim, cmd: Extract<Command, { type: 'inspect.settle' }>) => void } = {
  'inspect.settle': (sim, cmd) => {
    const insp = sim.world.get(cmd.inspection, InspectionC);
    if (!insp || insp.phase !== 'settle') return reject(sim, cmd.type, 'noInspection');
    const done = (outcome: 'fined' | 'bribed' | 'refused', cost: number): void => {
      sim.events.emit({ type: 'inspect.settled', inspection: cmd.inspection, faction: insp.faction, outcome, cost });
      leave(sim, cmd.inspection, insp, outcome);
    };
    if (cmd.choice === 'fine') {
      const paid = Math.min(insp.fine ?? 0, sim.trade.credits);
      sim.trade.credits -= paid;
      hit(sim, insp.faction, SCAN_STANDING_HIT);
      return done('fined', paid);
    }
    if (cmd.choice === 'refuse') {
      refuseConsequences(sim, insp);
      return done('refused', 0);
    }
    if (insp.bribeFailed) return reject(sim, cmd.type, 'bribeRefused');
    const bribe = insp.bribe ?? 0;
    if (sim.trade.credits < bribe) return reject(sim, cmd.type, 'cantAfford');
    if (!sim.rng.chance(INSPECT_BRIBE_CHANCE)) {
      insp.bribeFailed = true;
      hit(sim, insp.faction, SCAN_STANDING_HIT);
      sim.events.emit({ type: 'inspect.bribeRefused', inspection: cmd.inspection, faction: insp.faction });
      return;
    }
    sim.trade.credits -= bribe;
    handBack(sim, cmd.inspection, insp);
    done('bribed', bribe);
  },
};
