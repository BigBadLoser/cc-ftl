import { describe, expect, it } from 'vitest';
import { enemyWeaponRow } from './enemyWeapons';

const w = (o: Partial<Parameters<typeof enemyWeaponRow>[0]> = {}) => ({ destroyed: false, stalled: false, eta: null, fired: false, charge: 0.4, standDown: false, ...o });

describe('enemyWeaponRow', () => {
  it('is charging while below full charge, in no shot colour', () => {
    expect(enemyWeaponRow(w())).toEqual({ status: 'Charging', shotColor: false, dim: false });
  });

  it('reads Ready once fully charged and not aimed', () => {
    expect(enemyWeaponRow(w({ charge: 1 }))).toEqual({ status: 'Ready', shotColor: false, dim: false });
  });

  it('reads Stood down, dimmed, for a ship that yielded, whatever the weapon had', () => {
    expect(enemyWeaponRow(w({ standDown: true, charge: 1 }))).toEqual({ status: 'Stood down', shotColor: false, dim: true });
    expect(enemyWeaponRow(w({ standDown: true, stalled: true })).status).toBe('Stood down');
    expect(enemyWeaponRow(w({ standDown: true, destroyed: true })).status).toBe('Destroyed');
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
