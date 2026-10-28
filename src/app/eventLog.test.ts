import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CombatC, CrewC, DeadC, ModuleC, ShipC, homeShip, newGame, type SimEvent } from '../sim';
import { shipIdOf } from '../sim/regions';
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

describe('alerts clear against the sim state', () => {
  it('creatures-aboard clears when the hatched creatures are dead (corpses keep CrewC)', () => {
    const t = setup();
    const crew = t.sim.world.query(CrewC)[0] as number;
    t.feed({ type: 'eggsac.hatched', sac: 0, ship: homeShip(t.sim), x: 1, y: 1, aliens: [crew] });
    t.alerts.sync();
    expect(t.alerts.get(1)).toBeDefined();
    t.sim.world.add(crew, DeadC, { tick: 0 } as never);
    t.alerts.sync();
    expect(t.alerts.get(1)).toBeUndefined();
  });

  it('power shortage stays while a consumer is unpowered, and clears when all are powered', () => {
    const t = setup();
    const ship = homeShip(t.sim);
    const consumer = t.sim.world.query(ModuleC).find((id) => {
      const m = t.sim.world.get(id, ModuleC)!;
      return (t.sim.content.modules[m.def]?.power ?? 0) < 0 && shipIdOf(t.sim, m) === ship;
    }) as number;
    const m = t.sim.world.get(consumer, ModuleC)!;
    m.enabled = true;
    m.hp = 10;
    m.powered = false;
    t.feed({ type: 'power.shortage', ship, supply: 10, demand: 20 });
    t.alerts.sync();
    expect(t.alerts.get(1)).toBeDefined();
    for (const id of t.sim.world.query(ModuleC)) t.sim.world.get(id, ModuleC)!.powered = true; // the power system's verdict: everyone has power
    t.alerts.sync();
    expect(t.alerts.get(1)).toBeUndefined();
  });
});
