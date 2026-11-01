import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC, RolledSkillsC, TraitsC, newGame } from '../sim';
import { buildCrewLists } from './crewSnapshot';

describe('the crew card', () => {
  it('lists traits with their effect, and skills against the role', () => {
    const sim = newGame(1, content);
    const gunner = sim.world.query(CrewC).find((id) => sim.world.get(id, CrewC)?.role === 'role.gunner') as number;
    sim.world.add(gunner, TraitsC, { ids: ['trait.marksman'] });
    sim.world.add(gunner, RolledSkillsC, { skills: { gunnery: 2, piloting: 1 } });
    const card = buildCrewLists(sim).crew.find((c) => c.id === gunner)!;
    expect(card.traits).toEqual([{ id: 'trait.marksman', name: 'Marksman', kind: 'texture', flavour: 'Never misses twice.', effect: 'Gunnery +1.' }]);
    expect(card.skills).toEqual([{ skill: 'gunnery', value: 3, base: 3 }, { skill: 'piloting', value: 1, base: 0 }]);
  });
});
