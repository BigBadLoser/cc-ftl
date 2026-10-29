import { describe, expect, it } from 'vitest';
import { weaponLabels } from './weaponNames';

describe('weaponLabels', () => {
  it('numbers weapons that share a name by their order', () => {
    expect(weaponLabels([{ name: 'Burst laser' }, { name: 'Burst laser' }])).toEqual(['Burst laser I', 'Burst laser II']);
  });

  it('keeps a unique name as it is', () => {
    expect(weaponLabels([{ name: 'Burst laser' }, { name: 'Missile launcher' }, { name: 'Burst laser' }]))
      .toEqual(['Burst laser I', 'Missile launcher', 'Burst laser II']);
  });

  it('handles no weapons', () => {
    expect(weaponLabels([])).toEqual([]);
  });
});
