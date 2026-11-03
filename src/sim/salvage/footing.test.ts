import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { CrewC, PositionC } from '../crew/components';
import type { ContentRegistry } from '../registry';
import { Sim } from '../sim';
import { strandNobody } from './footing';

const content: ContentRegistry = { ships: {}, roles: {}, crewNames: [], recipes: {}, species: {}, modules: {}, items: {}, structCosts: {} };
// An L of deck in a ring of open space: a row of four floors and one below its east end.
const rows = ['......', '.____.', '...._.', '......'];
const floors = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 }];

function setup(): { sim: Sim; w: number } {
  const sim = new Sim(4, content);
  return { sim, w: stampShip(sim, { name: 'Wreck', rows, modules: [] }, { faction: 'neutral', x: 0, y: 0, state: 'wreck' }) };
}
function stand(sim: Sim, x: number, y: number): void {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
}

describe('strandNobody: floors that come down without cutting anyone off', () => {
  it('keeps the deck one piece: only its ends may go', () => {
    const { sim, w } = setup();
    expect(strandNobody(sim, w, floors)).toEqual([{ x: 1, y: 1 }, { x: 4, y: 2 }]);
  });

  it('leaves the floor that alone holds up a hull tile someone stands on', () => {
    const { sim, w } = setup();
    stand(sim, 0, 0); // on the hull ring, beside (1, 1) only
    expect(strandNobody(sim, w, floors)).toEqual([{ x: 4, y: 2 }]);
  });

  it('gives every floor when each would strand someone: the last one has to go', () => {
    const { sim, w } = setup();
    stand(sim, 0, 0);
    stand(sim, 5, 3); // beside (4, 2) only
    expect(strandNobody(sim, w, floors)).toEqual(floors);
    expect(strandNobody(sim, w, [{ x: 4, y: 2 }])).toEqual([{ x: 4, y: 2 }]);
  });
});
