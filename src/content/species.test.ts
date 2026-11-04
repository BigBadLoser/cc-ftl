import { describe, expect, it } from 'vitest';
import { species } from './species';

describe('species', () => {
  it('the augmented human is the human body plus its own differences, so base tuning never drifts (#303)', () => {
    const { name, maxHp, armor, fearless, ...rest } = species['species.augmented'];
    const { name: _n, ...human } = species['species.human'];
    void _n;
    expect(rest).toEqual(human);
    expect({ name, maxHp, armor, fearless }).toEqual({ name: 'Augmented human', maxHp: 130, armor: 0.1, fearless: true });
  });
});
