import { describe, expect, it } from 'vitest';
import {
  AirlockC, CrewC, HealthC, ModuleC, PositionC, SuitC, airlockSuits, airlockTiles, isTileWalkable, newGame, spawnShip, suitAir, suitDef,
  type ModuleDef, type Sim, type SimEvent,
} from '../../sim';
import { content } from '../index';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const airlockOf = (sim: Sim, gridId: number): number =>
  sim.world.query(AirlockC).find((i) => sim.world.get(i, ModuleC)!.gridId === gridId)!;
const crewOn = (sim: Sim, gridId: number): number[] => sim.world.query(CrewC).filter((i) => sim.world.get(i, PositionC)?.gridId === gridId);
const roleOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)!.role;

describe('EVA content', () => {
  it('values: 3 suits per airlock, a 4 minute tank, suited crew slower', () => {
    expect((content.modules['module.airlock'] as ModuleDef).airlock?.suits).toBe(3);
    expect(content.suit).toMatchObject({ airSec: 240, moveMult: 0.8, workMult: 0.9, accuracyMult: 0.8, floatRange: 6 });
    const sim = newGame(1, content);
    expect(suitDef(sim)).toBe(content.suit);
    expect(airlockSuits(sim, airlockOf(sim, 1))).toBe(3);
  });

  it('a drafted engineer suits up at the starter airlock and floats to a second ship, which opens through its own airlock', () => {
    const sim = newGame(3, content);
    spawnShip(sim, content.ships['ship.starter']!, { gridId: 2, faction: 'player', x: 15, y: 50 });
    const lock = airlockOf(sim, 1);
    const eng = crewOn(sim, 1).find((c) => roleOf(sim, c) === 'role.engineer')!;
    sim.enqueue({ type: 'crew.draft', id: eng, drafted: true });
    sim.enqueue({ type: 'eva.suitUp', crew: eng, airlock: lock });
    const ev = run(sim, 20 * 40);
    expect(ev.filter((e) => e.type === 'command.rejected')).toEqual([]);
    expect(sim.world.get(eng, SuitC)?.airlock).toBe(lock);
    expect(airlockSuits(sim, lock)).toBe(2);

    // A floor tile of the other ship's interior, away from its airlock.
    const g2 = sim.grids.get(2)!;
    const m2 = sim.world.get(airlockOf(sim, 2), ModuleC)!;
    const inside = airlockTiles(content.modules['module.airlock'] as ModuleDef, m2).inside;
    const dest = { x: inside.x + 2, y: inside.y };
    expect(isTileWalkable(sim, g2, dest.x, dest.y)).toBe(true);
    sim.enqueue({ type: 'crew.moveTo', id: eng, x: dest.x, y: dest.y, gridId: 2 });
    const ev2 = run(sim, 20 * 90);
    expect(ev2.filter((e) => e.type === 'crew.crossed')).toEqual([expect.objectContaining({ kind: 'eva', toGridId: 2 })]);
    expect(sim.world.get(eng, PositionC)).toMatchObject({ gridId: 2, x: dest.x, y: dest.y });
    expect(suitAir(sim, eng)).toBeLessThan(content.suit.airSec);
    expect(sim.world.get(eng, HealthC)!.hp).toBe(sim.world.get(eng, HealthC)!.max);
  });
});
