import type { Sim } from '../sim';
import { stepCoarse } from './coarse';
import { ensureArea } from './state';
import { COARSE_TURNS, SIM_RING, WARMUP_TICKS } from './tuningCoarse';

/**
 * A new game starts with lived-in borders: the simulated area is generated and WARMUP_TICKS coarse ticks run as history, at negative turns (so the game's first
 * turn is 0 and nothing owed by a flipped port is in the future). The news the warm-up wrote is dropped: the player starts with a clean log, not a past.
 * The app's new game asks for it (`saves.ts`); tests that want a fresh galaxy do not.
 */
export function warmGalaxy(sim: Sim, ticks: number = WARMUP_TICKS): void {
  const g = sim.galaxy;
  if (!sim.content.galaxy) return;
  ensureArea(sim, g.current, SIM_RING);
  const turn = g.turn;
  for (let n = -ticks; n < 0; n++) {
    g.turn = turn + n * COARSE_TURNS;
    stepCoarse(sim, g.turn);
  }
  g.turn = turn;
  g.news = [];
  g.rev++;
}
