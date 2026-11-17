import { describe, expect, it } from 'vitest';
import type { OreDef } from '../../sim/asteroids/types';
import { generateOutpost } from '../../sim/outposts/gen';
import { validateOutpost } from '../../sim/outposts/validate';
import { content } from '../index';
import { expectAirlocksClear } from '../../../test/support/fixtures/outposts';

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

describe('outpost airlocks, more seeds', () => {
  it('airlocks never open into rock: a dug base has only its dock, whose collar is space (seeds 5..20)', () => {
    for (const style of ['dug', 'surface'] as const) for (let seed = 5; seed <= 20; seed++) expectAirlocksClear(style, seed);
  }, 300000);
});
