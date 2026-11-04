import { describe, expect, it } from 'vitest';
import { CrewC, DeadC, DownedC, HealthC, NeedsC, newGame, type Sim } from '../sim';
import { playerCrew } from '../sim/story/world';
import { content } from '.';

/** Down a non-medic in a stabilised state and return the hp they regain in `secs` seconds. */
function healed(sim: Sim, secs: number): number {
  const patient = playerCrew(sim).find((id) => sim.world.get(id, CrewC)?.role !== 'role.medic')!;
  const hp = sim.world.get(patient, HealthC)!;
  hp.hp = 1;
  sim.world.add(patient, DownedC, { bleed: 1000, stabilized: true, bed: 0 });
  for (let i = 0; i < secs * 20; i++) sim.step();
  return hp.hp - 1;
}

describe('medicine', () => {
  it('a medic aboard speeds up healing in a bed, by their medicine skill', () => {
    const withMedic = newGame(3, content);
    expect(playerCrew(withMedic).some((id) => withMedic.world.get(id, CrewC)?.role === 'role.medic')).toBe(true);
    const without = newGame(3, content);
    for (const id of playerCrew(without)) {
      const c = without.world.get(id, CrewC)!;
      if (c.role === 'role.medic') c.role = 'role.engineer';
    }
    const a = healed(withMedic, 5);
    const b = healed(without, 5);
    expect(b).toBeGreaterThan(0);
    // Medicine 3 at SKILL_STEP 0.1: 30% faster.
    expect(a / b).toBeCloseTo(1.3, 1);
  });

  it('a patched patient still bleeds out while something harms them, and lives on when nothing does', () => {
    const outcome = (starving: boolean): boolean => {
      const sim = newGame(3, content);
      const patient = playerCrew(sim).find((id) => sim.world.get(id, CrewC)?.role !== 'role.medic')!;
      sim.world.get(patient, HealthC)!.hp = 0;
      sim.world.add(patient, DownedC, { bleed: 5, stabilized: false, bed: 0, patched: true });
      for (let i = 0; i < 8 * 20; i++) {
        if (starving) {
          const needs = sim.world.get(patient, NeedsC);
          if (needs) needs.hunger = 0;
          else sim.world.add(patient, NeedsC, { rest: 100, hunger: 0 });
        }
        sim.step();
      }
      return sim.world.has(patient, DeadC);
    };
    expect(outcome(true)).toBe(true);
    expect(outcome(false)).toBe(false);
  });
});
