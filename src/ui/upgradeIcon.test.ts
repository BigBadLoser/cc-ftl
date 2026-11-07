import { describe, expect, it } from 'vitest';
import { upgradeItems } from '../content/upgrades';
import { TABLER as ICONS } from './tablerIcons';
import { upgradeIconName } from './upgradeIcon';

describe('upgradeIconName', () => {
  it('gives every upgrade item its own line icon', () => {
    const names = Object.keys(upgradeItems).map((id) => upgradeIconName(id));
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(ICONS[n]).toBeTruthy();
  });
});
