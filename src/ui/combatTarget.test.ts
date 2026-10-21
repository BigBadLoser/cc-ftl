import { describe, expect, it } from 'vitest';
import type { UiShipCombat } from './api';
import { resolveTarget } from './combatTarget';

const enemy = {
  integrity: 0.9,
  modules: [
    { id: 5, name: 'Railgun', hp: 2, maxHp: 10, kind: 'weapon' },
    { id: 6, name: 'Engine', hp: 8, maxHp: 10, kind: 'engine' },
  ],
} as unknown as UiShipCombat;

describe('resolveTarget', () => {
  it('whole-ship target shows hull integrity', () => {
    expect(resolveTarget(enemy, 0, null)).toMatchObject({ label: 'Whole ship', moduleId: 0, pct: 90, override: false });
  });
  it('a weapon inheriting a module ship target shows the module hp, not hull', () => {
    expect(resolveTarget(enemy, 5, null)).toMatchObject({ label: 'Railgun', moduleId: 5, pct: 20, override: false });
  });
  it('a weapon override shows the override module hp', () => {
    expect(resolveTarget(enemy, 5, { moduleId: 6 })).toMatchObject({ label: 'Engine', moduleId: 6, pct: 80, override: true });
  });
  it('ship target with no weapon argument resolves the module', () => {
    expect(resolveTarget(enemy, 6).pct).toBe(80);
  });
});
