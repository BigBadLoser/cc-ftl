import { describe, expect, it } from 'vitest';
import {
  CrewC, JobC, ModuleC, PositionC, ShipC, newGame, shipOf, type Sim, type SimEvent,
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

/** Player starter ship at grid 1 and a raider at grid 2, 60 tiles away. */
function fight(seed = 1): Sim {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  return sim;
}
const modulesOf = (sim: Sim, gridId: number, def: string): number[] =>
  sim.world.query(ModuleC).filter((i) => sim.world.get(i, ModuleC)!.gridId === gridId && sim.world.get(i, ModuleC)!.def === def);
const crewOf = (sim: Sim, gridId: number): number[] => sim.world.query(CrewC).filter((i) => sim.world.get(i, PositionC)!.gridId === gridId);

describe('combat start and consoles', () => {
  it('starts combat and crew man their consoles by skill', () => {
    const sim = fight();
    const events = run(sim, 400);
    expect(events.filter((e) => e.type === 'combat.started')).toHaveLength(1);
    expect(sim.sector.inCombat).toBe(true);
    const manned = (gridId: number, def: string): string | undefined => {
      const [m] = modulesOf(sim, gridId, def) as [number];
      const job = sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!).find((j) => j.kind === 'operate' && j.target === m);
      return job && job.reservedBy ? sim.world.get(job.reservedBy, CrewC)!.role : undefined;
    };
    expect(manned(1, 'module.weaponsConsole')).toBe('role.gunner');
    expect(manned(1, 'module.helm')).toBe('role.pilot');
    expect(manned(1, 'module.shieldConsole')).toBeUndefined(); // engineers/medic do not volunteer
    expect(manned(2, 'module.weaponsConsole')).toBe('role.gunner');
    expect(manned(2, 'module.helm')).toBe('role.pilot');
    expect(sim.world.query(ShipC)).toHaveLength(2);
    expect(shipOf(sim, 2)?.state).toBe('active');
    expect(crewOf(sim, 2)).toHaveLength(3);
  });
});
