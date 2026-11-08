import { INSPECT_BAN_TURNS, INSPECT_BRIBE_CHANCE, INSPECT_REFUSE_HIT, SCAN_STANDING_HIT } from '../blackmarket/tuning';
import type { Command } from '../commands';
import { repKey } from '../galaxy/standing';
import { CrewC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { ItemStackC } from '../items/components';
import { holdsGoods, spillItems, stackSizeOf } from '../items/stacks';
import type { ItemQty } from '../registry';
import { shipGrid, shipIdOf } from '../regions';
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
 * - 'bribe': refused without the credits, or with no floor aboard to set the goods down on (`noRoom`). Taken with INSPECT_BRIBE_CHANCE (a seeded roll): it is paid and the goods are handed back (set down by
 *   the shuttle's door for the crew to stow). Turned down: nothing is paid, standing falls by SCAN_STANDING_HIT, and no bribe is offered again.
 * - 'refuse': nothing is paid; they leave with what they took, standing falls by INSPECT_REFUSE_HIT and the station refuses service for INSPECT_BAN_TURNS galaxy turns (`Trader.barredUntil`).
 *   (Fighting them is a later step: #138 step 3.)
 */

export const hit = (sim: Sim, faction: string, n: number): void => {
  const key = repKey(sim, faction);
  sim.story.reputation[key] = reputationOf(sim.story, key) - n;
};

/** What refusing (or running from) an inspection costs: a standing hit, and the station's service; a patrol turns hostile once its people are off (flow.ts). */
export function refuseConsequences(sim: Sim, insp: Inspection): void {
  hit(sim, insp.faction, INSPECT_REFUSE_HIT);
  if (insp.patrol !== undefined) insp.turnOnLeave = true;
  const t = sim.world.get(insp.station, TraderC);
  if (t) t.barredUntil = sim.galaxy.turn + INSPECT_BAN_TURNS;
}

/**
 * Where handed-back goods can be set down on the inspected ship, best first: by the shuttle's door, where an inspector or one of the player's crew stands
 * (the shuttle may hover with no tile by its hatch: the EVA path), then every tile of the ship that can hold goods.
 */
function dropSpots(sim: Sim, vehicle: number, insp: Inspection): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const at = cargoTile(sim, vehicle);
  if (at?.shipId === insp.ship) out.push(at);
  const people = [...insp.crew, ...sim.world.query(CrewC).filter((c) => sim.world.get(c, AllegianceC)?.faction === 'player')];
  for (const c of people) {
    const p = sim.world.get(c, PositionC);
    if (p && shipIdOf(sim, p) === insp.ship) out.push({ x: Math.round(p.x), y: Math.round(p.y) });
  }
  const grid = shipGrid(sim, insp.ship);
  if (grid) {
    for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
      for (let x = grid.x0; x < grid.x0 + grid.width; x++) if (grid.get('ship', x, y) === insp.ship && holdsGoods(grid, x, y)) out.push({ x, y });
    }
  }
  return out;
}

/** What the inspectors hold: the shuttle's hold and what they impounded in place. */
const heldBy = (sim: Sim, vehicle: number, insp: Inspection): ItemQty[] => [...(sim.world.get(vehicle, VehicleC)?.cargo ?? []), ...(insp.impounded ?? [])];

/** True when the inspected ship has floor for every unit they hold (free tiles a full stack each, and the room left on its stacks of the same item). */
function roomAboard(sim: Sim, vehicle: number, insp: Inspection): boolean {
  const grid = shipGrid(sim, insp.ship);
  if (!grid?.has('item')) return false;
  let free = 0;
  const partial = new Map<string, number>();
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('ship', x, y) !== insp.ship || !holdsGoods(grid, x, y)) continue;
      const s = sim.world.get(grid.get('item', x, y), ItemStackC);
      if (!s) free++;
      else if (!s.job) partial.set(s.item, (partial.get(s.item) ?? 0) + Math.max(0, stackSizeOf(sim, s.item) - s.count));
    }
  }
  for (const q of heldBy(sim, vehicle, insp)) {
    const max = stackSizeOf(sim, q.item);
    const rest = Math.max(0, q.count - (partial.get(q.item) ?? 0));
    partial.set(q.item, 0);
    free -= Math.ceil(rest / max);
    if (free < 0) return false;
  }
  return true;
}

/**
 * Set the seized goods down on the player's ship (a bribe taken): by the shuttle's door, else wherever on the ship there is floor. The bribe is only taken
 * when there is room for all of it (`roomAboard`); anything that still found no floor stays theirs to hand back (in the hold or impounded), never lost.
 */
function handBack(sim: Sim, vehicle: number, insp: Inspection): void {
  const v = sim.world.get(vehicle, VehicleC);
  const spots = dropSpots(sim, vehicle, insp);
  const place = (q: ItemQty): number => {
    let left = q.count;
    for (const at of spots) {
      if (left <= 0) break;
      left = spillItems(sim, insp.ship, at.x, at.y, q.item, left);
    }
    return left;
  };
  if (v) v.cargo = v.cargo.map((q) => ({ item: q.item, count: place(q) })).filter((q) => q.count > 0);
  insp.impounded = (insp.impounded ?? []).map((q) => ({ item: q.item, count: place(q) })).filter((q) => q.count > 0);
}

const reject = (sim: Sim, command: string, reason: string): void => sim.events.emit({ type: 'command.rejected', command, reason });

export const inspectHandlers: { 'inspect.settle': (sim: Sim, cmd: Extract<Command, { type: 'inspect.settle' }>) => void } = {
  'inspect.settle': (sim, cmd) => {
    const insp = sim.world.get(cmd.inspection, InspectionC);
    if (!insp || insp.phase !== 'settle') return reject(sim, cmd.type, 'noInspection');
    const done = (outcome: 'fined' | 'bribed' | 'refused', cost: number): void => {
      sim.events.emit({ type: 'inspect.settled', inspection: cmd.inspection, faction: insp.faction, outcome, cost, ...(insp.patrol !== undefined ? { patrol: true as const } : {}) });
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
    if (!roomAboard(sim, cmd.inspection, insp)) return reject(sim, cmd.type, 'noRoom'); // nowhere to set the goods down: no bribe
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
