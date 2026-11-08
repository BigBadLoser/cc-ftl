import { newGame, CrewC, NeedsC, type Sim } from '../../sim';
import { content } from '../index';

export const run = (sim: Sim, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
export const humans = (sim: Sim): number[] => sim.world.query(CrewC).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human');
export const needs = (sim: Sim, id: number) => sim.world.get(id, NeedsC)!;
/** Starter ship with a single hungry crew member; the rest are fed and held out of the way by being very rested. */
export function hungry(hunger: number): { sim: Sim; id: number } {
  const sim = newGame(3, content);
  run(sim, 5);
  for (const h of humans(sim)) needs(sim, h).hunger = 100;
  const id = humans(sim)[0] as number;
  needs(sim, id).hunger = hunger;
  return { sim, id };
}

