import { describe, expect, it } from 'vitest';
import { CrewC, HealthC, ModuleC, TICK_HZ, newGame, removeModule, totalStock } from '../../sim';
import { content } from '../index';
import { humans, hungry, needs } from './needsFixture';

// Slow tier: the natural-length hunger run and the ten-minute feeding run. needs.test.ts starts the hunger case near the moment it tests.
describe('needs, long runs', () => {
  it('a bedless floor sleeper from a hunger of 36 whose hunger runs low wakes, eats and does not starve (#278)', () => {
    const { sim, id } = hungry(100);
    for (const b of [...sim.world.query(ModuleC)]) if (sim.content.modules[sim.world.get(b, ModuleC)!.def]?.bed) removeModule(sim, b);
    needs(sim, id).rest = 19;
    needs(sim, id).hunger = 36;
    for (let i = 0; i < 30 * TICK_HZ && sim.world.get(id, CrewC)!.activity !== 'sleeping'; i++) sim.step();
    expect(sim.world.get(id, CrewC)!.activity).toBe('sleeping');
    let ate = false, lowest = 100;
    for (let i = 0; i < 900 * TICK_HZ && !ate; i++) {
      sim.step();
      ate = sim.events.drain().some((e) => e.type === 'crew.ate' && e.crew === id);
      lowest = Math.min(lowest, needs(sim, id).hunger as number);
    }
    expect(ate).toBe(true);
    expect(lowest).toBeGreaterThan(0);
    expect(sim.world.get(id, HealthC)!.hp).toBe(sim.world.get(id, HealthC)!.max);
  });

  it('keeps the starter crew fed for ten minutes of normal play', { timeout: 120000 }, () => {
    const sim = newGame(5, content);
    let starving = 0;
    for (let i = 0; i < 10 * 60 * TICK_HZ; i++) {
      sim.step();
      if (i % TICK_HZ === 0) for (const h of humans(sim)) if ((needs(sim, h).hunger ?? 1) <= 0) starving++;
    }
    expect(starving).toBe(0);
    // Foreign crews (an arrival may board the sector during ten minutes) have no hunger; the player's crew does.
    for (const h of humans(sim).filter((id) => needs(sim, id).hunger !== undefined)) expect(needs(sim, h).hunger as number).toBeGreaterThan(5);
    expect(totalStock(sim, 'item.ration')).toBeGreaterThanOrEqual(8); // the galley's keep order refills the larder
  });
});
