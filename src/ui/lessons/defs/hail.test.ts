import { describe, expect, it } from 'vitest';
import { checkCondition } from '../conditions';
import type { UiGoals, UiTradePartner } from '../../api';
import type { LessonCtx } from '../types';
import { hailLesson } from './hail';

const goals = (done: boolean): UiGoals => ({ act: 1, acts: 3, title: '', reward: '', goals: [{ id: 'goal.first_trade', title: '', text: '', done }] });
const station = (hail: UiTradePartner['hail'], distance = 5): UiTradePartner => ({ id: 7, station: true, hail, distance }) as UiTradePartner;
const ctx = (over: Partial<LessonCtx> & { hail?: UiTradePartner['hail']; fight?: boolean } = {}): LessonCtx => ({
  combat: { inCombat: !!over.fight, player: null, enemies: [] },
  aiming: null,
  trade: { credits: 0, partners: [station(over.hail ?? 'none')], deals: [] },
  selectedShip: null,
  goals: goals(false),
  busy: false,
  ...over,
});
const fires = (c: LessonCtx) => checkCondition(hailLesson.trigger, { ctx: c, signals: [] });

describe('hail lesson trigger', () => {
  it('fires with open trade goals, a station and no hail yet', () => expect(fires(ctx())).toBe(true));
  it('not once a station was hailed, in a fight, or with the goal done', () => {
    expect(fires(ctx({ hail: 'answered' }))).toBe(false);
    expect(fires(ctx({ fight: true }))).toBe(false);
    expect(fires(ctx({ goals: goals(true) }))).toBe(false);
    expect(fires(ctx({ goals: null }))).toBe(false);
  });
  it('not without a station', () => expect(fires(ctx({ trade: { credits: 0, partners: [], deals: [] } }))).toBe(false));
});

describe('hail lesson while', () => {
  const open = (c: LessonCtx) => checkCondition(hailLesson.while, { ctx: c, signals: [] });
  it('holds while a trade goal is open, closes in a fight or when both are done', () => {
    expect(open(ctx())).toBe(true);
    expect(open(ctx({ fight: true }))).toBe(false);
    expect(open(ctx({ goals: goals(true) }))).toBe(false);
  });
});
