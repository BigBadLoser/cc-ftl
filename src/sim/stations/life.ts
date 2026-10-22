import { PathC, type Position } from '../crew/components';
import { isSettled, origin } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { StationC, StationCrewC } from './components';

/** Per-tick chance an idle station crew member strolls to one of the station's courts (about once per 25 s). */
const STROLL_CHANCE = 0.002;

/** Idle station crew now and then stroll to a court (plaza, garden, mess). True if a walk was planned. */
export function strollTurn(sim: Sim, id: number, pos: Position): boolean {
  const sc = sim.world.get(id, StationCrewC);
  const busy = (sim.world.get(id, PathC)?.steps.length ?? 0) > 0 || !isSettled(pos);
  if (!sc || busy || shipIdOf(sim, pos) !== sc.station || !sim.rng.chance(STROLL_CHANCE)) return false;
  const courts = sim.world.get(sc.station, StationC)?.courts ?? [];
  if (courts.length === 0) return false;
  const goal = courts[sim.rng.int(0, courts.length - 1)] as { x: number; y: number };
  const steps = findPath(sim, sc.station, origin(pos), goal);
  const path = sim.world.get(id, PathC);
  if (!steps || steps.length === 0 || !path) return false;
  path.steps = steps;
  return true;
}
