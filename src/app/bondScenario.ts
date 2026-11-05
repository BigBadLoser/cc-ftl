import { AllegianceC, CrewC, type Command, type Sim } from '../sim';

/**
 * `?scenario=bonds`: look at relationships (issue #239). The first crew member of the player's has two friends and a rival, each with a
 * reason, so the crew card lists them and hovering one of them says why. Returns the crew member to select and the debug commands.
 */
export function bondScenario(sim: Sim): { crew: number | null; commands: Command[] } {
  const mine = sim.world.query(CrewC).filter((id) => {
    const c = sim.world.get(id, CrewC);
    return sim.world.get(id, AllegianceC)?.faction === 'player' && !!c && !sim.content.species[c.species]?.mechanical;
  });
  const [me, ...others] = mine;
  if (me === undefined) return { crew: null, commands: [] };
  const plan: [number | undefined, number, string][] = [[others[0], 62, 'fought'], [others[1], 55, 'chat'], [others[2], -58, 'row']];
  const commands: Command[] = plan.flatMap(([b, delta, reason]) => (b === undefined ? [] : [{ type: 'debug.bond' as const, a: me, b, delta, reason }]));
  return { crew: me, commands };
}
