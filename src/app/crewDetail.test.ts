import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC, RolledSkillsC, SkillXpC, TraitsC, newGame, stat } from '../sim';
import { buildCrewDetail } from './crewDetail';

describe('the crew inspector detail', () => {
  it('takes each skill apart into rolled, XP and trait terms that add up to the resolved level', () => {
    const sim = newGame(1, content);
    const id = sim.world.query(CrewC).find((i) => sim.world.get(i, CrewC)?.role === 'role.gunner') as number;
    sim.world.add(id, TraitsC, { ids: ['trait.marksman', 'trait.strong'] });
    sim.world.add(id, RolledSkillsC, { skills: { gunnery: 2, piloting: 1 } });
    sim.world.add(id, SkillXpC, { xp: { gunnery: 160 } });
    const d = buildCrewDetail(sim, id)!;
    const g = d.skills.find((s) => s.skill === 'gunnery')!;
    expect(g).toMatchObject({ value: 4, rolled: 2, xpLevels: 1, role: 3, xp: 60, per: 100 });
    expect(g.mods).toEqual([{ label: 'Marksman', kind: 'trait', op: 'add', value: 1 }]);
    for (const s of d.skills) expect(s.rolled + s.xpLevels + s.mods.reduce((n, m) => n + m.value, 0)).toBe(Math.round(stat(sim, id, s.skill as 'gunnery')));
    const carry = d.stats.find((s) => s.stat === 'carryCapacity')!;
    expect(carry.parts).toEqual([{ label: 'Strong', kind: 'trait', op: 'mul', value: 1.5 }]);
    expect(d.gear.map((g) => g.slot)).toEqual(['weapon', 'suit', 'hands', 'implant', 'implant']);
  });

  it('lists the mood factors over the base', () => {
    const sim = newGame(1, content);
    const id = sim.world.query(CrewC)[0]!;
    for (let i = 0; i < 30; i++) sim.step();
    const d = buildCrewDetail(sim, id)!;
    expect(d.mood?.base).toBe(50);
    expect(d.health.conditions.some((c) => c.key === 'rest')).toBe(true);
  });
});
