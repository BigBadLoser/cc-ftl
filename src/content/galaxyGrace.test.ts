import { describe, expect, it } from 'vitest';
import { newGame, nodeOf } from '../sim';
import { graceActive, graceHolds } from '../sim/galaxy/grace';
import { GRACE_ACT, GRACE_SEC } from '../sim/galaxy/tuning';
import { TICK_HZ } from '../sim/time';
import { content } from './index';

describe('opening grace', () => {
  const sim = () => newGame(1, content);

  it('is on at the start and holds hostile arrivals at the danger-0 home node', () => {
    const s = sim();
    const here = s.galaxy.current;
    expect(nodeOf(s, here)?.danger).toBe(0);
    expect(graceActive(s)).toBe(true);
    expect(graceHolds(s, here)).toBe(true);
  });

  it('ends after GRACE_SEC, when the goal chain is past its act, or when it is skipped', () => {
    const timed = sim();
    timed.tick = GRACE_SEC * TICK_HZ - 1;
    expect(graceActive(timed)).toBe(true);
    timed.tick++;
    expect(graceActive(timed)).toBe(false);
    const act = sim();
    act.story.goals.act = GRACE_ACT;
    expect(graceActive(act)).toBe(true);
    act.story.goals.act = GRACE_ACT + 1;
    expect(graceActive(act)).toBe(false);
    const skipped = sim();
    skipped.story.goals.skipped = true;
    expect(graceActive(skipped)).toBe(false);
  });
});
