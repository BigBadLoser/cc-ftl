import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { newGame } from '../sim';
import { ProjectileC } from '../sim/combat/components';
import { commitEtaSec, projectileEtaSec } from '../sim/combat/eta';

describe('impact ETA', () => {
  it('reads the seconds left of a shot in flight from its progress and speed', () => {
    const sim = newGame(3, content);
    const id = sim.world.createEntity();
    sim.world.add(id, ProjectileC, {
      weapon: 'w', fromShip: 1, fromModuleId: 0, target: { ship: 1, moduleId: 0 }, x0: 0, y0: 0, x1: 10, y1: 0, x: 5, y: 0, t: 0.5, dt: 0.01, spread: 0, pdRolled: false,
    });
    expect(projectileEtaSec(sim, id)).toBeCloseTo(2.5);
  });
  it('has no ETA for a weapon without a committed aim, or an entity that is not a shot', () => {
    const sim = newGame(3, content);
    expect(commitEtaSec(sim, 999999)).toBeNull();
    expect(projectileEtaSec(sim, 999999)).toBeNull();
  });
});
