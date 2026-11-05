import { describe, expect, it } from 'vitest';
import { ShipC, TraderC, newGame, type Deal } from '../sim';
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

const deal = (station: number, phase: Deal['phase']): Deal => ({ id: 77, ship: station, phase, vehicle: 0, give: [{ item: 'item.metal', count: 8 }], get: [], trip: { n: 1, of: 1 } } as unknown as Deal);

describe('station traffic log', () => {
  it('stamps with the top bar clock', () => {
    expect(clockAt(0)).toBe('00:00');
    expect(clockAt(20 * 40)).toBe('00:40');
    expect(clockAt(3 * 3600 * 20 + 20 * 65)).toBe('3:01:05');
  });

  it('records a deal moving through its phases, newest first, without logging what was already going on', () => {
    const { sim, station } = setup();
    sim.trade.deals.push(deal(station, 'out'));
    const log = new StationLog();
    log.observe(sim);
    expect(log.view(station).log).toEqual([]);
    for (const phase of ['dockStation', 'exchange', 'back', 'done'] as const) {
      sim.trade.deals[sim.trade.deals.length - 1]!.phase = phase;
      sim.tick += 20;
      log.observe(sim);
    }
    const lines = log.view(station).log;
    expect(lines.map((l) => l.what.split(' ')[0])).toEqual(['delivered', 'heading', 'swapping', 'docking']);
    expect(lines[0]!.at).toMatch(/^\d\d:\d\d$/);
  });

  it('notes ships entering and leaving range, and which way they head', () => {
    const { sim, station } = setup();
    const log = new StationLog();
    log.observe(sim);
    for (const [x, y] of [[100, 50], [10, 10], [150, 120], [10, 140], [170, 10]] as const) sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x, y });
    for (let i = 0; i < 5; i++) sim.step();
    log.observe(sim);
    const st = sim.world.get(station, ShipC)!;
    const other = sim.world.query(ShipC).find((id) => id !== station && sim.world.get(id, ShipC)?.faction !== 'player');
    if (!other) throw new Error('no ship spawned');
    const s = sim.world.get(other, ShipC)!;
    expect(log.view(station).log[0]?.what).toBe('entered sensor range');
    s.x = st.x + 200; s.y = st.y; log.observe(sim);
    s.x = st.x + 150; log.observe(sim);
    expect(log.view(station).heading(other)).toBe('in');
    s.x = st.x + 5000; log.observe(sim);
    expect(log.view(station).log[0]?.what).toBe('left sensor range');
  });
});
