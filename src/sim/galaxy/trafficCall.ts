import { ShipC } from '../combat/components';
import { atBattle } from '../combat/engage';
import { defineComponent } from '../ecs';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { freeShuttle, sendHome } from '../trade/courier';
import { isLive } from '../trade/deals';
import { freeAirlock } from '../trade/player';
import { VehicleC } from '../vehicles/components';
import { dockError } from '../vehicles/handlers';
import { TRADE_HOP_EVERY_SEC, TRADE_HOP_SEC } from './tuningWar';

/**
 * A station's shuttle calling at a visiting NPC trader (#603): it flies itself over (`vehicle.dock`), stays docked TRADE_HOP_SEC, flies home
 * (`sendHome`, the rule every station shuttle job ends with) and rests TRADE_HOP_EVERY_SEC before the station sends it again. No goods move: the
 * trade is settled at descriptor level when the fleet docks (dock.ts `onDock`). On the shuttle; phases:
 * - 'out': on its way to the trader's airlock;
 * - 'docked': at the airlock;
 * - 'back': flying home;
 * - 'rest': home again, waiting out the pause (the shuttle is free for the player's deals meanwhile: one that takes it ends the call).
 */
export interface ShuttleCall {
  /** The trader it calls at, and the airlock it docks at there. */
  ship: number;
  airlock: number;
  phase: 'out' | 'docked' | 'back' | 'rest';
  /** Ticks in this phase. */
  timer: number;
}
export const ShuttleCallC = defineComponent<ShuttleCall>('shuttleCall');

/** The station shuttles with a call under way or resting after one, lowest id first (read through the vehicles: no empty store in old saves). */
export const shuttleCalls = (sim: Sim): number[] => sim.world.query(VehicleC).filter((id) => sim.world.has(id, ShuttleCallC)).sort((a, b) => a - b);

/** Calls that count as traffic in the node (`NPC_ACTIVITIES`): those not resting at home. */
export const activeCalls = (sim: Sim): number => shuttleCalls(sim).filter((id) => sim.world.get(id, ShuttleCallC)?.phase !== 'rest').length;

/** The call gives way: the player is trading (a live deal, which also holds the node's fleets: galaxy/fleets.ts), or a fight is on. */
const yields = (sim: Sim, station: number, ship: number): boolean => sim.trade.deals.some(isLive) || atBattle(sim, station) || atBattle(sim, ship);

/**
 * Send `station`'s shuttle to call at `ship`: its free shuttle (`freeShuttle`, the one answer the player's deals use too) docks at a free airlock of
 * the trader. False when it cannot go now (no shuttle free, the station is resting one, no airlock, a deal of the player's or a fight under way).
 */
export function startCall(sim: Sim, station: number, ship: number): boolean {
  if (yields(sim, station, ship) || shuttleCalls(sim).some((id) => sim.world.get(id, VehicleC)?.homeShip === station)) return false;
  const free = freeShuttle(sim, station);
  if ('error' in free) return false;
  const airlock = freeAirlock(sim, free.vehicle, 0, ship);
  const v = sim.world.get(free.vehicle, VehicleC);
  if (!airlock || !v) return false;
  v.autopilot = true;
  sim.world.add(free.vehicle, ShuttleCallC, { ship, airlock, phase: 'out', timer: 0 });
  sim.enqueue({ type: 'vehicle.dock', vehicle: free.vehicle, airlock });
  return true;
}

function go(c: ShuttleCall, phase: ShuttleCall['phase']): void {
  c.phase = phase;
  c.timer = 0;
}

/** One tick of a call (the traffic system). */
export function stepCall(sim: Sim, id: number, c: ShuttleCall): void {
  const v = sim.world.get(id, VehicleC);
  if (!v) return;
  c.timer++;
  const there = sim.world.get(c.ship, ShipC)?.state === 'active' && !yields(sim, v.homeShip, c.ship);
  if ((c.phase === 'out' || c.phase === 'docked') && !there) go(c, 'back');
  switch (c.phase) {
    case 'out':
      if (v.state === 'docked' && v.dock === c.airlock) return go(c, 'docked');
      if (c.timer > TRADE_HOP_EVERY_SEC * TICK_HZ) return go(c, 'back'); // it never got there
      if (v.dest?.type === 'dock' && v.dest.airlock === c.airlock) return;
      // Its airlock was taken meanwhile (the player's shuttle): another free one, else home.
      if (dockError(sim, id, c.airlock) !== null) c.airlock = freeAirlock(sim, id, 0, c.ship);
      if (!c.airlock) return go(c, 'back');
      if (c.timer % TICK_HZ === 0) sim.enqueue({ type: 'vehicle.dock', vehicle: id, airlock: c.airlock });
      return;
    case 'docked':
      if (c.timer > TRADE_HOP_SEC * TICK_HZ) go(c, 'back');
      return;
    case 'back':
      if (sendHome(sim, id)) go(c, 'rest');
      return;
    case 'rest':
      // Another job took the shuttle while it rested (a player's deal: `freeShuttle` offers it): the call lets it go.
      if (v.state !== 'stowed') return void sim.world.remove(id, ShuttleCallC);
      if (c.timer > TRADE_HOP_EVERY_SEC * TICK_HZ) sim.world.remove(id, ShuttleCallC);
  }
}

/** The calls move along (each tick): a call whose station is gone ends where it is. */
export function tendCalls(sim: Sim): void {
  for (const id of shuttleCalls(sim)) {
    const v = sim.world.get(id, VehicleC);
    if (!v || sim.world.get(v.homeShip, ShipC)?.state !== 'active') {
      sim.world.remove(id, ShuttleCallC);
      continue;
    }
    stepCall(sim, id, sim.world.get(id, ShuttleCallC)!);
  }
}
