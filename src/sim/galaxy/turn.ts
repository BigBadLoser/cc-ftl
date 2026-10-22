import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { expireEncounters } from './encounters';
import { stepFleets } from './fleets';
import { TURN_SEC } from './tuning';

/**
 * The starmap is turn-based, and a turn comes from two triggers that share `GalaxyState.turn` and both call `onTurn`:
 * - a hop entered (`takeHopTurn`, from `galaxy.jump` and `advanceTravel`), and
 * - game time (`tickTurnClock`): every TURN_SEC (180, three minutes) seconds while the sector is 'active' at a node.
 * No double counting: `GalaxyState.turnClock` counts only active ticks, and is reset when a hop's turn is taken and at `sector.deploy`
 * (`resetTurnClock`), so a hop never also fires a time turn for the same stretch.
 */

/** Ticks of active game time that make one turn. */
export const TIME_TURN_TICKS = Math.round(TURN_SEC * TICK_HZ);

/**
 * The per-turn hook, called once per turn with the new turn number (`GalaxyState.turn`, already advanced). It emits `galaxy.turn`
 * (`cause: 'time'` for a game-time turn, absent for a hop), expires old encounters and moves the NPC fleets one step
 * (fleets.ts).
 * Runs inside the sim step, so it may enqueue nothing and must only read and write sim state through the sim's own functions.
 */
export function onTurn(sim: Sim, turn: number, cause: 'hop' | 'time' = 'hop'): void {
  sim.events.emit(cause === 'time' ? { type: 'galaxy.turn', turn, cause } : { type: 'galaxy.turn', turn });
  expireEncounters(sim, turn);
  stepFleets(sim, turn);
}

/** A hop is entered: the next turn, and the game-time clock starts over. */
export function takeHopTurn(sim: Sim): void {
  sim.galaxy.turnClock = 0;
  onTurn(sim, ++sim.galaxy.turn, 'hop');
}

/** One active tick of game time; a turn when TIME_TURN_TICKS have gone by. Called by the galaxy system. */
export function tickTurnClock(sim: Sim): void {
  const g = sim.galaxy;
  if (++g.turnClock < TIME_TURN_TICKS) return;
  g.turnClock = 0;
  onTurn(sim, ++g.turn, 'time');
  g.rev++;
}

/** Restart the game-time clock (a deploy begins a fresh stretch at the node). */
export function resetTurnClock(sim: Sim): void {
  sim.galaxy.turnClock = 0;
}
