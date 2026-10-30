import { describe, expect, it } from 'vitest';
import { allOf, anyOf, checkCondition, onCommand, onEvent, when } from './conditions';
import { keyText } from './keyText';
import type { LessonFrame } from './types';

const frame = (signals: LessonFrame['signals'], inCombat = false): LessonFrame => ({
  ctx: { combat: { inCombat, player: null, enemies: [] }, aiming: null, busy: false },
  signals,
});

describe('lesson conditions', () => {
  it('matches events, commands (with a predicate), states and combinators', () => {
    const f = frame([{ kind: 'command', command: { type: 'combat.vent', ship: 7 } }], true);
    expect(checkCondition(onCommand('combat.vent'), f)).toBe(true);
    expect(checkCondition(onCommand('combat.vent', (c) => c.ship === 1), f)).toBe(false);
    expect(checkCondition(onEvent('combat.started'), f)).toBe(false);
    expect(checkCondition(when((c) => c.combat.inCombat), f)).toBe(true);
    expect(checkCondition(anyOf(onEvent('combat.started'), when((c) => c.combat.inCombat)), f)).toBe(true);
    expect(checkCondition(allOf(onEvent('combat.started'), when((c) => c.combat.inCombat)), f)).toBe(false);
  });

  it('splits key badges out of step text', () => {
    expect(keyText('Press [Q] or [Shift]+[Q].')).toEqual([
      { key: false, text: 'Press ' }, { key: true, text: 'Q' }, { key: false, text: ' or ' },
      { key: true, text: 'Shift' }, { key: false, text: '+' }, { key: true, text: 'Q' }, { key: false, text: '.' },
    ]);
  });
});
