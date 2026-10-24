import { describe, expect, it } from 'vitest';
import { WORK_CATEGORIES, type RecipeDef } from '../sim';
import { content } from './index';

describe('work categories', () => {
  it('Refine and Craft are separate columns', () => {
    expect(WORK_CATEGORIES).toContain('refining');
    expect(WORK_CATEGORIES).toContain('crafting');
  });

  it('refinery recipes are refining; fab, workbench and galley recipes are crafting', () => {
    for (const [id, r] of Object.entries(content.recipes as Record<string, RecipeDef>)) {
      const refinery = r.station === 'module.refinery';
      expect(r.category ?? 'crafting', id).toBe(refinery ? 'refining' : 'crafting');
    }
    expect(Object.values(content.recipes as Record<string, RecipeDef>).some((r) => r.station === 'module.refinery')).toBe(true);
  });

  it('every worker role sets every category, and defaults sensible refine/craft levels', () => {
    for (const [id, role] of Object.entries(content.roles)) {
      for (const c of WORK_CATEGORIES) expect(role.priorities[c], `${id} ${c}`).toBeTypeOf('number');
    }
    expect(content.roles['role.engineer']?.priorities.refining).toBeGreaterThan(0);
    expect(content.roles['role.robot_worker']?.priorities.refining).toBeGreaterThan(0);
    // Combat roles do not refine by default; creatures do no work at all.
    expect(content.roles['role.gunner']?.priorities.refining).toBe(4);
    expect(content.roles['role.alien_hunter']?.priorities.refining).toBe(0);
  });
});
