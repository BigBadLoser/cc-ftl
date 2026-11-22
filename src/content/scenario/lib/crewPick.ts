import { CrewC, type Sim, isPlayers } from '../../../sim';

/** The player's organic (not mechanical) crew, in creation order. */
export function organicCrew(sim: Sim): number[] {
  return sim.world.query(CrewC).filter((id) => {
    const c = sim.world.get(id, CrewC);
    return isPlayers(sim, id, { held: false }) && !!c && !sim.content.species[c.species]?.mechanical;
  });
}

/** One of them: by index, or by role id (the first of that role, else the first crew member). */
export function pickCrew(sim: Sim, who: number | string): number | undefined {
  const mine = organicCrew(sim);
  if (typeof who === 'number') return mine[who];
  return mine.find((id) => sim.world.get(id, CrewC)?.role === who) ?? mine[0];
}
