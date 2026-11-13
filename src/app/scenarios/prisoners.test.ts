import { describe, expect, it } from 'vitest';
import { CrewC, newGame } from '../../sim';
import { fullSlabs, slabPlace } from '../../sim/stasis/query';
import { heldItems } from '../../sim/items/held';
import { SLAB_ITEM } from '../../sim/stasis/tuning';
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

  it('in the app\'s start (the Wayfarer, seed 1, prisoners taken a few ticks in) every slab is accounted for and both prisoners end in the wheel', () => {
    const sim = newGame(1, content, 'ship.wayfarer', true, 'rolled');
    const before = new Set(sim.world.query(CrewC));
    for (const cmd of prisonerCommands(sim)) sim.enqueue(cmd);
    for (let i = 0; i < 9; i++) sim.step();
    const caught = newHostiles(sim, before);
    for (const id of caught) sim.enqueue({ type: 'debug.imprison', crew: id });
    // Empty slabs anywhere (slots, storage, floor, in hand) plus full ones: the ten the wheel came with and the two spares, at every tick.
    const slabs = (): number => heldItems(sim).filter((h) => h.item === SLAB_ITEM).reduce((n, h) => n + h.count, 0) + fullSlabs(sim).length;
    for (let i = 0; i < 4000 && !caught.every((id) => slabPlace(sim, id)?.kind === 'wheel'); i++) {
      sim.step();
      expect(slabs()).toBe(12);
    }
    expect(caught.map((id) => slabPlace(sim, id)?.kind)).toEqual(['wheel', 'wheel']);
  });
});
