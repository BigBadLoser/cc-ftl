import { describe, expect, it } from 'vitest';
import { generateOutpost, validateOutpost, type OreDef } from '../../sim';
import { content } from '../index';

const CTX = { ores: Object.values(content.ores) as OreDef[], modules: content.modules, stations: content.stations };

describe('outpost sweep', () => {
  it('seeds 1..40 of both styles give a valid outpost', () => {
    const bad: string[] = [];
    for (const style of ['surface', 'dug'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const o = generateOutpost(style, seed, CTX);
        if (!o) { bad.push(`${style} #${seed}: no layout`); continue; }
        const p = validateOutpost(o, content.modules);
        if (p.length) bad.push(`${style} #${seed}: ${p.join('; ')}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
