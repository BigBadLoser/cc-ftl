import { AllegianceC, CrewC, type Command, type Sim } from '../sim';

/**
 * `?scenario=inspector`: look at the crew inspector's tabs. The first organic crew member of the player's (a gunner when
 * there is one) gets several traits, some skill XP, a rifle in hand and a few needs low enough to show in their mood.
 * Returns the crew member to select and the debug commands that set them up.
 */
export function inspectorScenario(sim: Sim): { crew: number | null; commands: Command[] } {
  const mine = sim.world.query(CrewC).filter((id) => {
    const c = sim.world.get(id, CrewC);
    return sim.world.get(id, AllegianceC)?.faction === 'player' && !!c && !sim.content.species[c.species]?.mechanical;
  });
  const crew = mine.find((id) => sim.world.get(id, CrewC)?.role === 'role.gunner') ?? mine[0] ?? null;
  if (crew === null) return { crew, commands: [] };
  return {
    crew,
    commands: [{
      type: 'debug.setCrew', id: crew, weapon: 'item.rifle', hunger: 52, rest: 24,
      traits: ['trait.marksman', 'trait.strong', 'trait.workaholic', 'trait.social', 'trait.gifted'],
      xp: { gunnery: 160, repair: 45, piloting: 70 },
    }],
  };
}
