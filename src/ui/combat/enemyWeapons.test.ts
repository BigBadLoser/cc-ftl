import { describe, expect, it } from 'vitest';
import { enemyWeaponRow } from './enemyWeapons';

const w = (o: Partial<Parameters<typeof enemyWeaponRow>[0]> = {}) => ({ destroyed: false, stalled: false, eta: null, fired: false, ...o });

describe('enemyWeaponRow', () => {
  it('is charging by default, in no shot colour', () => {
    expect(enemyWeaponRow(w())).toEqual({ status: 'Charging', shotColor: false, dim: false });
  });

  it('shows the countdown once committed, in the shot colour', () => {
    expect(enemyWeaponRow(w({ eta: 2.43 }))).toEqual({ status: 'Aimed 2.4s', shotColor: true, dim: false });
  });

  it('keeps the shot colour while its shot is in flight', () => {
    expect(enemyWeaponRow(w({ fired: true }))).toEqual({ status: 'Fired', shotColor: true, dim: false });
  });

  it('dims an offline weapon and a destroyed one, destroyed first', () => {
    expect(enemyWeaponRow(w({ stalled: true })).status).toBe('Offline');
    expect(enemyWeaponRow(w({ stalled: true, destroyed: true }))).toMatchObject({ status: 'Destroyed', dim: true });
  });
});
