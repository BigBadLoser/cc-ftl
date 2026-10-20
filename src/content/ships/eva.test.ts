import { describe, expect, it } from 'vitest';
import {
  AirlockC, CrewC, HealthC, ModuleC, PositionC, SuitC, airlockSuits, airlockTiles, isTileWalkable, newGame, suitAir, suitDef,
  type ModuleDef, type Sim, type SimEvent,
} from '../../sim';
import { content } from '../index';
import { gridIdOf } from '../../sim/regions';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const airlockOf = (sim: Sim, gridId: number): number =>
  sim.world.query(AirlockC).find((i) => gridIdOf(sim, sim.world.get(i, ModuleC)) === gridId)!;
const crewOn = (sim: Sim, gridId: number): number[] => sim.world.query(CrewC).filter((i) => sim.world.get(i, PositionC)?.gridId === gridId);
const roleOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)!.role;

describe('EVA content', () => {
  it('values: 3 suits per airlock, a 4 minute tank, suited crew slower', () => {
    expect((content.modules['module.airlock'] as ModuleDef).airlock?.suits).toBe(3);
    expect(content.suit).toMatchObject({ airSec: 240, moveMult: 0.8, workMult: 0.9, accuracyMult: 0.8, });
    const sim = newGame(1, content);
    expect(suitDef(sim)).toBe(content.suit);
    expect(airlockSuits(sim, airlockOf(sim, 1))).toBe(3);
  });

  it('a drafted engineer suits up at the starter airlock and walks out onto the hull beside its collar', () => {
    const sim = newGame(3, content);
    const lock = airlockOf(sim, 1);
    const eng = crewOn(sim, 1).find((c) => roleOf(sim, c) === 'role.engineer')!;
    sim.enqueue({ type: 'crew.draft', id: eng, drafted: true });
    sim.enqueue({ type: 'eva.suitUp', crew: eng, airlock: lock });
    const ev = run(sim, 20 * 40);
    expect(ev.filter((e) => e.type === 'command.rejected')).toEqual([]);
    expect(sim.world.get(eng, SuitC)?.airlock).toBe(lock);
    expect(airlockSuits(sim, lock)).toBe(2);

    const collar = airlockTiles(content.modules['module.airlock'] as ModuleDef, sim.world.get(lock, ModuleC)!).collar!;
    const out = { x: collar.x, y: collar.y + 1 };
    expect(isTileWalkable(sim, sim.grids.get(1)!, out.x, out.y, true)).toBe(true);
    sim.enqueue({ type: 'crew.moveTo', id: eng, x: out.x, y: out.y });
    run(sim, 20 * 40);
    expect(sim.world.get(eng, PositionC)).toMatchObject({ gridId: 1, x: out.x, y: out.y });
    expect(suitAir(sim, eng)).toBeLessThan(content.suit.airSec);
    expect(sim.world.get(eng, HealthC)!.hp).toBe(sim.world.get(eng, HealthC)!.max);
  });
});
