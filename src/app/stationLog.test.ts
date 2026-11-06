import { describe, expect, it } from 'vitest';
import { ShipC, TraderC, newGame, type SimEvent } from '../sim';
import { isLive } from '../sim/trade/deals';
import { content } from '../content';
import { StationLog, clockAt } from './stationLog';

function setup() {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4 });
  for (let i = 0; i < 5; i++) sim.step();
  sim.events.drain();
  const station = sim.world.query(TraderC).find((id) => sim.world.get(id, TraderC)?.station && sim.world.has(id, ShipC));
  if (!station) throw new Error('no station');
  return { sim, station };
}

const arrival = (x: number, y: number, over: Partial<Extract<SimEvent, { type: 'ship.arrived' }>> = {}): SimEvent =>
  ({ type: 'ship.arrived', ship: 900, name: 'Raider 9', faction: 'hostile', owner: 'raiders', reason: 'jump-in', x, y, ...over });

describe('station traffic log', () => {
  it('stamps with the top bar clock', () => {
    expect(clockAt(0)).toBe('00:00');
    expect(clockAt(20 * 40)).toBe('00:40');
    expect(clockAt(3 * 3600 * 20 + 20 * 65)).toBe('3:01:05');
  });

  it('records a trade run from the sim events, newest first, stamped with the tick each happened in, including the launch', () => {
    const { sim, station } = setup();
    const log = new StationLog();
    sim.enqueue({ type: 'trade.hail', ship: station });
    sim.step();
    sim.enqueue({ type: 'trade.offer', ship: station, give: [{ item: 'item.metal', count: 5 }], get: [{ item: 'item.metal', count: 5 }] });
    sim.step();
    sim.enqueue({ type: 'trade.accept', offer: sim.trade.offers[0]!.id });
    const phaseTicks: number[] = [];
    for (let i = 0; i < 20000 && (i === 0 || sim.trade.deals.some(isLive)); i++) {
      sim.step();
      const events = sim.events.drain();
      for (const e of events) if (e.type === 'trade.phase') phaseTicks.push(sim.events.tickOf(e, -1));
      log.onEvents(sim, events);
    }
    const lines = log.view(station).log;
    const what = lines.map((l) => l.what.split(' ')[0]).reverse();
    expect(what).toEqual(expect.arrayContaining(['loading', 'launched', 'docking', 'swapping', 'delivered']));
    expect(what.indexOf('launched')).toBeLessThan(what.indexOf('docking'));
    expect(what[what.length - 1]).toBe('delivered');
    expect(lines[0]!.at).toBe(clockAt(phaseTicks[phaseTicks.length - 1]!));
    expect(lines.length).toBeLessThanOrEqual(16);
    expect(phaseTicks.every((t) => t >= 0)).toBe(true);
  });

  it('has nothing for a calm station: no events, no lines, and no look at the sim to guess from', () => {
    const { sim, station } = setup();
    for (let i = 0; i < 5; i++) sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100 + i * 10, y: 50 });
    sim.step();
    const log = new StationLog();
    sim.events.drain();
    log.onEvents(sim, []);
    expect(log.view(station).log).toEqual([]);
  });

  it('notes ships arriving and leaving within sensor range, and skips the far ones and a node drop', () => {
    const { sim, station } = setup();
    const st = sim.world.get(station, ShipC)!;
    const cx = st.x + st.width / 2;
    const cy = st.y + st.height / 2;
    const log = new StationLog();
    log.onEvents(sim, [arrival(cx + 100, cy), arrival(cx + 5000, cy, { name: 'Far one' })]);
    expect(log.view(station).log.map((l) => [l.who, l.what])).toEqual([['Raider 9', 'jumped in']]);
    log.onEvents(sim, [{ type: 'ship.departed', ship: 900, name: 'Raider 9', faction: 'hostile', owner: 'raiders', reason: 'fled', x: cx + 100, y: cy }]);
    expect(log.view(station).log[0]).toMatchObject({ who: 'Raider 9', what: 'jumped away' });
    log.onEvents(sim, [{ type: 'ship.departed', ship: 901, name: 'Wreck 1', faction: 'hostile', owner: 'raiders', reason: 'wrecked', x: cx + 10, y: cy }]);
    expect(log.view(station).log[0]!.what).toBe('destroyed');
    const before = log.view(station).log.length;
    sim.sector.state = 'hyperspace'; // ships placed while the player drops into a node are not news
    log.onEvents(sim, [arrival(cx + 20, cy)]);
    expect(log.view(station).log).toHaveLength(before);
  });

  it('leaves out handover jobs and deals of ships that are not stations', () => {
    const { sim, station } = setup();
    const log = new StationLog();
    const base: Omit<Extract<SimEvent, { type: 'trade.phase' }>, 'ship' | 'handover'> = { type: 'trade.phase', deal: 1, from: 'load', to: 'out', vehicle: 5, dock: 0, trip: null, give: [], get: [] };
    log.onEvents(sim, [{ ...base, ship: station, handover: true }, { ...base, ship: sim.world.query(ShipC).find((i) => i !== station)!, handover: false }]);
    expect(log.view(station).log).toEqual([]);
  });
});
