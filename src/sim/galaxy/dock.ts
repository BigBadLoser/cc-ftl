import type { Sim } from '../sim';
import type { Port } from './ports';
import type { Fleet } from './types';

/**
 * Called when a fleet docks at a port: it has arrived at a node that has one (its home, or a station it trades at) and is about to dwell there.
 * A hook for stage 3 of the living world (traders buying and selling real station stock); it does nothing yet. It runs in the turn step, so it
 * must be deterministic and may only change sim state through the sim's own functions.
 */
export function onDock(sim: Sim, fleet: Fleet, port: Port): void {
  void sim;
  void fleet;
  void port;
}
