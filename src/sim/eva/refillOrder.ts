import { PositionC } from '../crew/components';
import { abortTask } from '../ai/task';
import { DraftedC } from '../crew/components';
import { startRefill } from '../ai/machines/refill';
import type { Sim } from '../sim';
import { airSources, type AirSource } from './sources';
import { isSuited, needsAir } from './suit';

/**
 * A player's `eva.refill` order for a drafted crew member (the refill machine before the air drive exists, #286 slice 0): walk to the chosen
 * source and fill the tank there. `airlock` / `vehicle` pick the source, else the nearest one they can reach. Replaces whatever they were doing
 * and drops their move order. Returns the rejection reason, or null once the errand has started.
 */
export function refillOrder(sim: Sim, crew: number, airlock?: number, vehicle?: number): string | null {
  const pos = sim.world.get(crew, PositionC);
  if (!pos) return 'incapacitated';
  if (!needsAir(sim, crew)) return 'airless';
  if (!isSuited(sim, crew)) return 'notSuited';
  const all = airSources(sim, crew);
  const want = airlock || vehicle;
  const src: AirSource | undefined = want ? all.find((s) => s.id === want && s.kind === (airlock ? 'airlock' : 'vehicle')) : all[0];
  if (!src) return 'noSource';
  abortTask(sim, crew, 'order');
  const drafted = sim.world.get(crew, DraftedC)!;
  drafted.target = null;
  delete drafted.planned;
  startRefill(sim, crew, src, src.steps);
  return null;
}
