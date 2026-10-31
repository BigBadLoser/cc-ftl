import { describe, expect, it } from 'vitest';
import { allOf, anyOf, checkCondition, onCommand, onEvent, when } from './conditions';
import { keyText } from './keyText';
import type { LessonFrame } from './types';

const frame = (signals: LessonFrame['signals'], inCombat = false): LessonFrame => ({
  ctx: { combat: { inCombat, player: null, enemies: [] }, aiming: null, trade: { credits: 0, partners: [], deals: [] }, selectedShip: null, goals: null, busy: false },
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

  it('resolves [@action] badges to the bound key', () => {
    expect(keyText('[@combat.volley] fires', (id) => (id === 'combat.volley' ? 'V' : ''))).toEqual([{ kind: 'key', text: 'V' }, { kind: 'text', text: ' fires' }]);
    expect(keyText('[@nope]', () => '')).toEqual([{ kind: 'key', text: 'unbound' }]);
  });

  it('splits key badges and strong words out of step text', () => {
    expect(keyText('Press [Q] or [Shift]+[Q] to **arm**.')).toEqual([
      { kind: 'text', text: 'Press ' }, { kind: 'key', text: 'Q' }, { kind: 'text', text: ' or ' },
      { kind: 'key', text: 'Shift' }, { kind: 'text', text: '+' }, { kind: 'key', text: 'Q' }, { kind: 'text', text: ' to ' },
      { kind: 'strong', text: 'arm' }, { kind: 'text', text: '.' },
    ]);
  });
});
