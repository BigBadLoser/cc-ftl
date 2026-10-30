import { describe, expect, it } from 'vitest';
import { content } from './index';

describe('weapon display names', () => {
  it('every weapon has a short, one-line name for the combat HUD cards', () => {
    for (const [id, def] of Object.entries(content.weapons ?? {})) {
      expect(def.shortName, id).toBeTruthy();
      expect((def.shortName as string).length, id).toBeLessThanOrEqual(14);
    }
  });

  it('the missile launcher reads "Missiles"', () => {
    expect(content.weapons?.['weapon.missile']?.shortName).toBe('Missiles');
  });
});
