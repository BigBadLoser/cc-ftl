import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../sim/events';
import { HEAT_MAX } from '../../sim/combat/heatTuning';
import { combat, fight, run, sim } from '../../../test/support/fixtures/heat';

const TPS = 20;

/** The AI's heat management over the whole 150 s fight (heat.test.ts stops once it has vented and passed half the ceiling). */
describe('heat, a whole fight', () => {
  it('the AI manages its own heat through a whole fight: it vents and does not stay overheated', () => {
    const f = fight(3, false);
    sim(f).enqueue({ type: 'combat.setTarget', ship: f.mine, weaponId: null, targetShip: f.foe, targetModuleId: 0 });
    const ev: SimEvent[] = [];
    let peak = 0;
    for (let i = 0; i < 150 * TPS; i++) {
      run(f, 1, ev);
      peak = Math.max(peak, combat(f, 'foe').heat.value);
    }
    expect(ev.some((e) => e.type === 'combat.vented' && e.ship === f.foe)).toBe(true);
    expect(ev.filter((e) => e.type === 'combat.overheated' && e.ship === f.foe)).toHaveLength(0);
    expect(peak).toBeGreaterThan(HEAT_MAX * 0.5);
  });
});
