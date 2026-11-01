import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC, PositionC, SuitC, RolledSkillsC, SkillXpC, TraitsC, newGame, stat } from '../sim';
import { shipGrid, shipIdOf } from '../sim/regions';
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
    expect(d.gear.map((g) => g.slot)).toEqual(['weapon', 'suit', 'hands', 'implant']);
    expect(d.cards['item.rifle']?.rows.find((r) => r.label === 'Accuracy')?.extra?.good).toBe(true);
  });

  it("puts a suit's aim penalty on the suit, not on the skill", () => {
    const sim = newGame(1, content);
    const id = sim.world.query(CrewC).find((i) => sim.world.get(i, CrewC)?.role === 'role.gunner') as number;
    const acc = () => buildCrewDetail(sim, id)!.cards['item.rifle']?.rows.find((r) => r.label === 'Accuracy');
    const bare = acc()!;
    sim.world.add(id, SuitC, { worn: true });
    const suited = acc()!;
    expect(suited.extra).toEqual(bare.extra);
    expect(bare.note).not.toMatch(/suit/);
    expect(suited.note).toMatch(/−\d+% suit/);
  });

  it('lists the mood factors over the base', () => {
    const sim = newGame(1, content);
    const id = sim.world.query(CrewC)[0]!;
    for (let i = 0; i < 30; i++) sim.step();
    const d = buildCrewDetail(sim, id)!;
    expect(d.mood?.base).toBe(50);
    expect(d.health.conditions.some((c) => c.key === 'rest')).toBe(true);
  });

  it('names an environment penalty by its cause, not its size (thin air on a lit tile is not a dark room)', () => {
    const sim = newGame(1, content);
    const id = sim.world.query(CrewC)[0]!;
    const p = sim.world.get(id, PositionC)!;
    const grid = shipGrid(sim, shipIdOf(sim, p))!;
    grid.set('light', p.x, p.y, 100);
    grid.set('o2', p.x, p.y, 5);
    const work = buildCrewDetail(sim, id)!.stats.find((s) => s.stat === 'workSpeed')!;
    expect(work.parts.map((x) => x.label)).toContain('Thin air');
    expect(work.parts.map((x) => x.label)).not.toContain('Dark room');
    grid.set('light', p.x, p.y, 0);
    expect(buildCrewDetail(sim, id)!.stats.find((s) => s.stat === 'moveSpeed')!.parts.map((x) => x.label)).toEqual(['Dark room']);
  });
});
