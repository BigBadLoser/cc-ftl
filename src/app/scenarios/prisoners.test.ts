import { describe, expect, it } from 'vitest';
import { CrewC, newGame } from '../../sim';
import { slabPlace } from '../../sim/stasis/query';
import { content } from '../../content';
import { newHostiles, prisonerCommands } from './prisoners';

describe('?scenario=prisoners', () => {
  it('sets a wheel and two prisoners, and the crew hold both in the wheel', () => {
    const sim = newGame(3, content);
    sim.step();
    const before = new Set(sim.world.query(CrewC));
    const cmds = prisonerCommands(sim);
    expect(cmds.map((c) => c.type)).toEqual(['debug.spawnModule', 'debug.spawnCrew', 'debug.spawnCrew', 'debug.spawnItems']);
    for (const cmd of cmds) sim.enqueue(cmd);
    sim.step();
    const caught = newHostiles(sim, before);
    expect(caught).toHaveLength(2);
    for (const id of caught) sim.enqueue({ type: 'debug.imprison', crew: id });
    for (let i = 0; i < 4000 && !caught.every((id) => slabPlace(sim, id)?.kind === 'wheel'); i++) sim.step();
    expect(caught.map((id) => slabPlace(sim, id)?.kind)).toEqual(['wheel', 'wheel']);
  });
});
