import { describe, expect, it } from 'vitest';
import type { ItemDef, ModuleDef, RecipeDef } from '../sim';
import { content as raw } from './index';

const content = raw as unknown as { items: Record<string, ItemDef>; recipes: Record<string, RecipeDef>; modules: Record<string, ModuleDef> };

const SCRAP = ['item.scrap_hull', 'item.scrap_tech', 'item.scrap_energy', 'item.scrap_weapons', 'item.scrap_comfort'];

describe('scrap content', () => {
  it('has no reference to the removed generic item.scrap', () => {
    expect(content.items['item.scrap']).toBeUndefined();
    expect(JSON.stringify(content, (_k, v) => (typeof v === 'function' ? undefined : v))).not.toMatch(/"item\.scrap"/);
  });

  it('every scrap type has a scrapper recipe whose output is worth less than its source parts and whose items exist', () => {
    for (const id of SCRAP) {
      expect(content.items[id]?.tags).toContain('scrap');
      const r = Object.values(content.recipes).find((x) => x.station === 'module.scrapper' && x.inputs.some((i) => i.item === id));
      expect(r, id).toBeDefined();
      for (const o of [...r!.outputs, ...(r!.extras ?? []), ...r!.inputs]) expect(content.items[o.item], o.item).toBeDefined();
      const value = (l: { item: string; count: number }[]): number => l.reduce((n, q) => n + (content.items[q.item]?.price ?? 0) * q.count, 0);
      expect(value(r!.outputs)).toBeLessThan(value(r!.inputs) * 6);
      for (const x of r!.extras ?? []) expect(x.chance).toBeLessThanOrEqual(0.1);
    }
  });

  it('the scrap bin takes only scrap', () => {
    expect(content.modules['module.storage_scrap']?.storageAccepts).toEqual(SCRAP);
    expect(content.modules['module.scrapper']?.crafting).toBe(true);
  });
});

describe('module scrap types', () => {
  it('every module has a scrap type except the robot modules', () => {
    const robot = ['module.robotFabricator', 'module.robotBay', 'module.aiCore'];
    for (const [id, def] of Object.entries(content.modules)) {
      if (robot.includes(id)) expect(def.scrap, id).toBeUndefined();
      else expect(['hull', 'tech', 'energy', 'weapons', 'comfort'], id).toContain(def.scrap);
    }
  });
});
