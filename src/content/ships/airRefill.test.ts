import { describe, expect, it } from 'vitest';
import { AirlockC, CrewC, ModuleC, PositionC, SuitC, airSources, airlockAir, newGame, suitAir, suitDef, type Sim, type SimEvent } from '../../sim';
import { shipIdOf } from '../../sim/regions';
import { content } from '../index';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};

describe('air stores on the starter ship', () => {
  it('a suited engineer finds the starter airlock as a source, fills a low tank there on order, and the store goes down by what was drawn', () => {
    const sim = newGame(3, content);
    const home = shipIdOf(sim, sim.world.get(sim.world.query(CrewC)[0] as number, PositionC));
    const lock = sim.world.query(AirlockC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === home) as number;
    const eng = sim.world.query(CrewC).find((c) => sim.world.get(c, CrewC)!.role === 'role.engineer') as number;
    const tank = suitDef(sim).airSec;
    expect(airlockAir(sim, lock)).toBe(3 * tank);
    sim.enqueue({ type: 'crew.draft', id: eng, drafted: true });
    sim.enqueue({ type: 'suit.set', crew: eng, worn: true });
    run(sim, 2);
    sim.world.get(eng, SuitC)!.air = 120;
    expect(airSources(sim, eng).map((s) => [s.kind, s.id])).toEqual([['airlock', lock]]);
    sim.enqueue({ type: 'eva.refill', crew: eng });
    const ev = run(sim, 20 * 40);
    expect(ev.filter((e) => e.type === 'command.rejected')).toEqual([]);
    expect(suitAir(sim, eng)).toBe(tank);
    // The draw came out of the store; the starter ship's life support has put back 2 s of air per second since.
    expect(airlockAir(sim, lock)).toBeGreaterThanOrEqual(3 * tank - (tank - 120));
    expect(airlockAir(sim, lock)).toBeLessThan(3 * tank - (tank - 120) + 2 * 40 + 1);
  });
});
