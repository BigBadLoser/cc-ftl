import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CombatC, ShipC, homeShip, newGame, type SimEvent } from '../sim';
import { createAlerts } from './alerts';
import { createEventLog } from './eventLog';
import type { UiLogEntry } from '../ui/api';

function setup() {
  const sim = newGame(3, content);
  const alerts = createAlerts(sim);
  const log = createEventLog(sim);
  const feed = (...events: SimEvent[]) => {
    alerts.onEvents(events);
    log.onEvents(events);
  };
  let current: UiLogEntry[] = [];
  log.list.subscribe((l) => (current = l));
  return { sim, alerts, log, feed, list: () => current };
}

describe('ship log and alerts', () => {
  it('logs events that raise an alert too, and keeps them when the alert goes', () => {
    const t = setup();
    t.feed({ type: 'fire.started', ship: homeShip(t.sim), room: 1, x: 5, y: 6 });
    expect(t.alerts.get(1)).toBeDefined();
    expect(t.list()).toMatchObject([{ kind: 'fire', subject: { kind: 'tile', x: 5, y: 6 } }]);
    t.alerts.dismiss(1);
    expect(t.list()).toHaveLength(1);
  });

  it('logs log-only events without raising an alert', () => {
    const t = setup();
    t.feed({ type: 'trade.hailAnswered', ship: 9, name: 'Mira' });
    expect(t.list().map((e) => e.text)).toEqual(['Mira answered the hail']);
    let n = -1;
    t.alerts.list.subscribe((l) => (n = l.length));
    expect(n).toBe(0);
  });

  it('highlights a credit gain with its amount, whatever the event', () => {
    const t = setup();
    t.sim.trade.credits += 450;
    t.feed({ type: 'story.effect', text: 'A reward' } as SimEvent);
    expect(t.list()[0]).toMatchObject({ kind: 'payout', amount: 450, tone: 'good' });
    t.sim.trade.credits -= 100; // a spend is not a payout
    t.log.sync();
    expect(t.list()[0]?.amount).toBe(450);
  });

  it('catches credits that arrive without any event', () => {
    const t = setup();
    t.sim.trade.credits += 30;
    t.log.sync();
    expect(t.list()[0]).toMatchObject({ kind: 'payout', amount: 30 });
  });

  it('names the trader that paid the player', () => {
    const t = setup();
    t.sim.trade.credits += 80;
    t.feed({ type: 'trade.settled', deal: 1, ship: 2, credits: -80 });
    expect(t.list()).toHaveLength(1);
    expect(t.list()[0]).toMatchObject({ kind: 'payout', amount: 80 });
  });

  it('combat alert jumps to the enemy ship and clears when combat ends', () => {
    const t = setup();
    const enemy = t.sim.world.query(ShipC).find((id) => id !== homeShip(t.sim) && t.sim.world.has(id, CombatC));
    if (enemy !== undefined) t.sim.world.get(enemy, ShipC)!.faction = 'hostile';
    t.sim.sector.inCombat = true;
    t.feed({ type: 'combat.started' });
    const a = t.alerts.get(1);
    expect(a?.kind).toBe('combat.started');
    if (enemy !== undefined) expect(a?.subject).toEqual({ kind: 'ship', id: enemy });
    t.alerts.sync();
    expect(t.alerts.get(1)).toBeDefined();
    t.sim.sector.inCombat = false;
    t.alerts.sync();
    expect(t.alerts.get(1)).toBeUndefined();
  });
});
