import { AllegianceC, CrewC, PositionC, Struct, homeShip, shipGrid, type Command, type Sim } from '../sim';

/**
 * `?scenario=breaks`: look at mental breaks (issue #175). The first four organic crew members of the player's each start a break at once, with a
 * minute on the clock: a panic over a fire (an urgent alert, the crew member flees and cowers), a tantrum, a despair and a work refusal (log
 * lines, and the inspector's Conditions line). The tantrum also dips the mood of the crew around it. Returns the panicking crew member to select
 * and the debug commands.
 */
export function breakScenario(sim: Sim): { crew: number | null; commands: Command[] } {
  const mine = sim.world.query(CrewC).filter((id) => {
    const c = sim.world.get(id, CrewC);
    return sim.world.get(id, AllegianceC)?.faction === 'player' && !!c && !sim.content.species[c.species]?.mechanical;
  });
  const kinds = [['panic', 'fire'], ['tantrum', 'lowMood'], ['despair', 'lowMood'], ['refusal', 'lowMood']] as const;
  const commands: Command[] = mine.slice(0, kinds.length).map((id, i) => ({ type: 'debug.breakCrew', id, kind: kinds[i]![0], context: kinds[i]![1], sec: 60 }));
  // The panic has something to flee: a fire two or three tiles from that crew member.
  const first = mine[0] && sim.world.get(mine[0], PositionC);
  const ship = homeShip(sim);
  const grid = shipGrid(sim, ship);
  if (first && grid) {
    for (let d = 2; d <= 3; d++) {
      const t = [[d, 0], [-d, 0], [0, d], [0, -d]].map(([dx, dy]) => ({ x: Math.round(first.x) + dx!, y: Math.round(first.y) + dy! }))
        .find((c) => grid.inBounds(c.x, c.y) && grid.get('struct', c.x, c.y) === Struct.Floor && !grid.get('module', c.x, c.y));
      if (t) {
        commands.unshift({ type: 'debug.ignite', ship, x: t.x, y: t.y });
        break;
      }
    }
  }
  return { crew: mine[0] ?? null, commands };
}
