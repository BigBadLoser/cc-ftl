import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { abortTask } from '../ai/task';
import { FighterC } from '../fight/components';
import { isIncapacitated } from '../crew/helpers';
import { airlockWorking } from '../modules/airlock';
import type { Sim } from '../sim';
import { startErrand } from '../ai/machines/eva';
import { findSuitSource, type SuitSource } from '../eva/errands';
import { isSuited, needsAir, suitNeeded } from '../eva/suit';
import { shipGrid, shipIdOf } from '../regions';
import { AboardC, EmbarkOrderC, VehicleC } from './components';
import { boardingTile } from './geometry';
import { occupants, vehicleDefOf } from './lifecycle';

/**
 * Send a crew member to board a vehicle: drafted (out of their job and bed claim) and walking to its boarding tile, where the
 * vehicle system boards them. Returns a reject reason, or null. `vehicle.embark` and the mining system (sending a pilot to a
 * pod) share it.
 */
export function sendToEmbark(sim: Sim, crew: number, vehicle: number): string | null {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return 'noVehicle';
  if (!sim.world.has(crew, CrewC) || sim.world.has(crew, DeadC) || sim.world.has(crew, AboardC)) return 'noCrew';
  if (isIncapacitated(sim, crew) || !sim.world.has(crew, PositionC)) return 'incapacitated';
  const at = boardingTile(sim, vehicle);
  if (!at) return 'notBoardable';
  if (v.state === 'docked' && !airlockWorking(sim, v.dock)) return 'airlockDown';
  if (occupants(v).length >= (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) return 'full';
  // The suit is settled before anything changes: a refusal leaves the crew member at their work.
  const suit = suitFirst(sim, crew, at);
  if (suit === 'none') return 'noSuit';
  let drafted = sim.world.get(crew, DraftedC);
  if (!drafted) {
    abortTask(sim, crew, 'drafted');
    drafted = { target: null };
    sim.world.add(crew, DraftedC, drafted);
    (sim.world.get(crew, CrewC) as { activity: string }).activity = 'drafted';
  }
  drafted.target = { x: at.x, y: at.y };
  delete drafted.planned;
  if (suit !== 'ready') {
    // Off for a suit first (the errand drops the walk; the vehicle system sets it again once the suit is on).
    drafted.target = null;
    startErrand(sim, crew, 'suitUp', suit, at.shipId);
  }
  const fighter = sim.world.get(crew, FighterC);
  if (fighter) fighter.ordered = 0; // climbing in replaces an attack order
  sim.world.add(crew, EmbarkOrderC, { vehicle, ...(suit === 'ready' ? { suited: true as const } : {}) });
  return null;
}

/**
 * A walk to a boarding tile out on open ground (a landing pad, #509) is made in a suit: someone who breathes and wears none first goes for one
 * at the nearest airlock (the ordinary suit-up errand). 'ready': the walk can start now (suited, airless, or the tile has air); a suit
 * source: off for a suit there first; 'none': there is no suit to be had. Reads only.
 */
function suitFirst(sim: Sim, crew: number, at: { shipId: number; x: number; y: number }): 'ready' | 'none' | SuitSource {
  const grid = shipGrid(sim, at.shipId);
  const pos = sim.world.get(crew, PositionC);
  if (!grid || !pos || !needsAir(sim, crew) || isSuited(sim, crew) || !suitNeeded(grid, at.x, at.y)) return 'ready';
  const src = findSuitSource(sim, crew, pos);
  return !src || shipIdOf(sim, pos) !== at.shipId ? 'none' : src;
}
