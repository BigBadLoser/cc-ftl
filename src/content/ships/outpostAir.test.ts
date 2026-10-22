import { describe, expect, it } from 'vitest';
import { ShipC, Sim, Struct, shipGrid } from '../../sim';
import { content } from '../index';

/** Mean o2 + co2 per room of the base (room id -> kPa). */
function rooms(sim: Sim, ship: number): Map<number, number> {
  const g = shipGrid(sim, ship)!;
  const sums = new Map<number, { p: number; n: number }>();
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      const k = g.get('struct', x, y);
      if (k !== Struct.Floor) continue;
      const r = g.get('room', x, y);
      const s = sums.get(r) ?? { p: 0, n: 0 };
      s.p += g.get('o2', x, y) + g.get('co2', x, y);
      s.n++;
      sums.set(r, s);
    }
  }
  return new Map([...sums].map(([r, s]) => [r, s.p / s.n]));
}

describe('outpost air', () => {
  for (const style of ['dug', 'surface'] as const) {
    it(`${style}: every room keeps its pressure within 1% over 120 s, and nothing vents`, () => {
      const sim = new Sim(1, content);
      sim.enqueue({ type: 'debug.spawnOutpost', style, seed: 1 });
      sim.step();
      const ship = [...sim.world.query(ShipC)][0]!;
      for (let i = 0; i < 40; i++) sim.step(); // rooms labelled, life support settled in
      const start = rooms(sim, ship);
      const bad: string[] = [];
      for (let i = 0; i < 120 * 20; i++) {
        sim.step();
        for (const e of sim.events.drain()) if (e.type === 'hull.breach' || e.type === 'o2.low') bad.push(e.type);
      }
      const end = rooms(sim, ship);
      for (const p0 of start.values()) expect(p0).toBeGreaterThan(20.5);
      for (const [r, p0] of start) expect(Math.abs((end.get(r) ?? 0) - p0) / p0, `room ${r}: ${p0} -> ${end.get(r)}`).toBeLessThan(0.01);
      expect(bad).toEqual([]);
    });
  }
});
