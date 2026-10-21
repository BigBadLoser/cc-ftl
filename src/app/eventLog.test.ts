import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content';
import { newGame, type SimEvent } from '../sim';
import { createAlerts } from './alerts';
import { createEventLog } from './eventLog';

/** Wired the way the controller does it. */
function setup() {
  const sim = newGame(3, content);
  const alerts = createAlerts(sim);
  const log = createEventLog(sim);
  alerts.onRaised(log.defer);
  alerts.onCleared((a, _t, replaced) => log.release(a.id, replaced));
  const feed = (...events: SimEvent[]) => {
    alerts.onEvents(events);
    log.onEvents(events, alerts.covers);
  };
  let current: { text: string; tone: string; kind: string }[] = [];
  log.list.subscribe((l) => (current = l));
  return { sim, alerts, log, feed, list: () => current };
}

describe('event log and alerts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds a covered event until its alert clears', () => {
    const t = setup();
    t.feed({ type: 'trade.hailAnswered', ship: 9, name: 'Mira' });
    expect(t.list()).toHaveLength(0);
    vi.advanceTimersByTime(46000);
    expect(t.list().map((e) => e.text)).toEqual(['Mira answered the hail']);
  });

  it('logs the oldest alert when a full queue pushes it out', () => {
    const t = setup();
    for (let ship = 1; ship <= 7; ship++) t.feed({ type: 'trade.hailAnswered', ship, name: `Ship${ship}` });
    expect(t.list().map((e) => e.text)).toEqual(['Ship1 answered the hail']);
  });

  it('keeps a story notice in the log, with its title, after the alert is dismissed', () => {
    const t = setup();
    t.feed({ type: 'story.started', event: 'event.notice_comet', mode: 'notice', notice: 0 });
    const alert = t.alerts.list;
    let id = 0;
    alert.subscribe((l) => (id = l[0]?.id ?? 0));
    expect(id).toBeGreaterThan(0);
    expect(t.list()).toHaveLength(0);
    t.alerts.dismiss(id);
    expect(t.list()).toMatchObject([{ kind: 'story', tone: 'info', text: content.events?.['event.notice_comet']?.title }]);
  });

  it('keeps the tone of deferred trade entries', () => {
    const t = setup();
    t.feed({ type: 'trade.hailRefused', ship: 1, name: 'Ann', reason: 'hostile' });
    t.feed({ type: 'trade.failed', deal: 4, ship: 2, reason: 'x' });
    t.feed({ type: 'trade.dealMade', deal: 5, ship: 2, courier: 'them', balance: 0 });
    t.feed({ type: 'trade.delivered', deal: 6, ship: 2, to: 'player' });
    t.feed({ type: 'trade.settled', deal: 7, ship: 2, credits: 5 });
    vi.advanceTimersByTime(46000);
    expect(t.list().map((e) => e.tone).sort()).toEqual(['good', 'good', 'good', 'warn', 'warn']);
  });

  it('does not log a replaced alert twice', () => {
    const t = setup();
    t.feed({ type: 'trade.hailAnswered', ship: 1, name: 'Ann' });
    t.feed({ type: 'trade.hailAnswered', ship: 1, name: 'Ann' });
    vi.advanceTimersByTime(46000);
    expect(t.list()).toHaveLength(1);
  });
});
