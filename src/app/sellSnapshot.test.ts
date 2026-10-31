import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { newGame, playerItems } from '../sim';
import { whereToSell } from './sellSnapshot';

describe('where to sell', () => {
  it('lists the market goods aboard with the known ports that pay most, dearest first', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.galaxyReveal', radius: 1 });
    sim.step();
    const goods = whereToSell(sim);
    expect(goods.length).toBeGreaterThan(0);
    for (const g of goods) {
      expect(playerItems(sim, g.item)).toBe(g.count);
      expect(g.best.length).toBeLessThanOrEqual(3);
      for (let i = 1; i < g.best.length; i++) expect(g.best[i - 1]!.price).toBeGreaterThanOrEqual(g.best[i]!.price);
      expect(new Set(g.best.map((p) => p.node)).size).toBe(g.best.length);
    }
    expect(goods.some((g) => g.best.length > 0)).toBe(true);
  });
});
