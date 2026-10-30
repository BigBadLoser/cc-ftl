import { describe, expect, it } from 'vitest';
import { AllegianceC, AssignmentC, CrewC, JobC, PathC, PositionC, Sim } from '../sim';
import { parkCrew } from './parkCrew';

describe('parkCrew', () => {
  it('releases the job a parked crew member held so others can take it', () => {
    const sim = new Sim(1, { ships: {}, roles: {}, modules: {}, species: {}, crewNames: [], items: {}, recipes: {}, structCosts: {} } as never);
    const c = sim.world.createEntity();
    sim.world.add(c, CrewC, { name: 'T', role: 'r', species: 's', appearanceSeed: 1, activity: 'idle' });
    sim.world.add(c, PositionC, { x: 1, y: 1, toX: 1, toY: 1, progress: 0, facing: 0 });
    sim.world.add(c, PathC, { steps: [] });
    sim.world.add(c, AllegianceC, { faction: 'player' });
    const j = sim.world.createEntity();
    sim.world.add(j, JobC, { category: 'construction', kind: 'build', x: 5, y: 1, struct: 1, work: 40, progress: 0, reservedBy: 0 });
    sim.world.get(j, JobC)!.reservedBy = c;
    sim.world.add(c, AssignmentC, { jobId: j });
    expect(sim.world.get(j, JobC)?.reservedBy).toBe(c);
    parkCrew(sim, 8, 3);
    expect(sim.world.get(j, JobC)?.reservedBy).toBe(0);
    expect(sim.world.has(c, AssignmentC)).toBe(false);
    expect(sim.world.get(c, PositionC)).toMatchObject({ x: 8, y: 3 });
  });
});
