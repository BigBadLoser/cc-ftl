import { describe, expect, it } from 'vitest';
import { Sim, stampShip, type ContentRegistry } from '../sim';
import { windowPlan } from './windowTool';

const content: ContentRegistry = { ships: {}, roles: {}, species: {}, modules: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} };
const rows = ['##########', '#___#____#', '#___#____#', '#___#____#', '#___#____#', '##########'];

function make() {
  const sim = new Sim(5, content);
  const ship = stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  return { sim, ship };
}

describe('windowPlan', () => {
  it('takes the axis from the wall and centres the run on the cursor', () => {
    const { sim, ship } = make();
    const x = windowPlan(sim, ship, { x: 7, y: 0 }, 3)!;
    expect(x).toMatchObject({ axis: 'x', start: { x: 6, y: 0 }, error: null });
    const y = windowPlan(sim, ship, { x: 4, y: 3 }, 2)!;
    expect(y).toMatchObject({ axis: 'y', start: { x: 4, y: 3 }, error: null });
  });
  it('slides the run along the wall to stay off the corner, and reports why when nothing fits', () => {
    const { sim, ship } = make();
    expect(windowPlan(sim, ship, { x: 1, y: 0 }, 3)).toMatchObject({ start: { x: 1, y: 0 }, error: null });
    expect(windowPlan(sim, ship, { x: 2, y: 2 }, 2)!.error).toBe('notWall');
    expect(windowPlan(sim, ship, { x: 4, y: 0 }, 2)!.error).toBe('notStraight'); // the partition's foot is a junction: every run holding it fails
  });
});
