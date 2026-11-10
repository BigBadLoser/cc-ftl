import { describe, expect, it } from 'vitest';
import { content } from './index';
import { newGame } from '../sim/newGame';
import { CrewC, type Job } from '../sim/crew/components';
import { RolledSkillsC } from '../sim/crew/traits';
import { workSkill, workSkillMult } from '../sim/crew/workSkill';

const job = (o: Partial<Job>): Job => ({ category: 'repair', kind: 'repair', x: 0, y: 0, struct: 0, work: 10, progress: 0, reservedBy: 0, ...o }) as Job;

describe('the job-kind -> skill map (TRAITS.md 10.2)', () => {
  it('names the skill a job trains: construction work, farming botany, meals cooking, other crafts industry', () => {
    const sim = newGame(1, content);
    expect(workSkill(sim, job({ kind: 'repair' }))).toBe('construction');
    expect(workSkill(sim, job({ kind: 'extinguish' }))).toBe('construction');
    expect(workSkill(sim, job({ kind: 'plant' }))).toBe('botany');
    expect(workSkill(sim, job({ kind: 'craft', craft: { recipe: 'recipe.parts' } as Job['craft'] }))).toBe('industry');
    const meal = Object.entries(content.recipes).find(([, r]) => 'quality' in r && r.quality)?.[0] as string;
    expect(workSkill(sim, job({ kind: 'craft', craft: { recipe: meal } as Job['craft'] }))).toBe('cooking');
    expect(workSkill(sim, job({ kind: 'haul' }))).toBeUndefined();
  });

  it('speeds Construction, Botany and Industry work by SKILL_STEP a level, nothing else', () => {
    const sim = newGame(1, content);
    const id = sim.world.query(CrewC)[0] as number;
    sim.world.add(id, RolledSkillsC, { skills: { construction: 4, botany: 10, science: 10, cooking: 8 } });
    expect(workSkillMult(sim, id, job({ kind: 'build' }))).toBeCloseTo(1.2);
    expect(workSkillMult(sim, id, job({ kind: 'harvest' }))).toBeCloseTo(1.5);
    expect(workSkillMult(sim, id, job({ kind: 'craft', craft: { recipe: 'recipe.parts' } as Job['craft'] }))).toBe(1); // industry 0
    expect(workSkillMult(sim, id, job({ kind: 'research' }))).toBe(1); // science speeds research where it is worked
    expect(workSkillMult(sim, id, job({ kind: 'haul' }))).toBe(1);
  });
});
