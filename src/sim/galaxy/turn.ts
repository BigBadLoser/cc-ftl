import type { Sim } from '../sim';

/**
 * The per-turn hook of the turn-based starmap: called once for every hop entered (the first on `galaxy.jump`, each later one as the
 * ship passes a node), with the new turn number (`GalaxyState.turn`, already advanced). It only emits `galaxy.turn` for now.
 * NEXT SLICE: NPC ships move one step along their routes here, route crossings trigger encounters, and a pirate crossing the player's
 * route can interdict (force a drop out of hyperspace into combat). The hook runs inside the sim step, so it may enqueue nothing and
 * must only read and write sim state through the sim's own functions.
 */
export function onTurn(sim: Sim, turn: number): void {
  sim.events.emit({ type: 'galaxy.turn', turn });
}
