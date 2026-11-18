import { describe, expect, it } from 'vitest';
import { totalStock } from '../../sim/items/stock';
import { content } from '../index';
import { bedAt, farmGame, plotOf, secs } from '../../../test/support/fixtures/farm';
import { run } from '../../../test/support/sim';

// Slow tier: the crop grows for its whole growing time (food.test.ts starts it a few seconds short of grown).
describe('hydroponics, grown in full', () => {
  it('plant, grow and harvest: the crop grows while powered, the yield is hauled to storage', () => {
    const { sim, bed } = farmGame();
    const greens = content.crops['crop.greens'];
    sim.enqueue({ type: 'plot.setCrop', moduleId: bed, crop: 'crop.greens' });
    run(sim, secs(40));
    expect(plotOf(sim, bed).planted).toBe('crop.greens');
    const grown = run(sim, secs(greens.growSec));
    expect(grown.some((e) => e.type === 'crop.harvested' && e.count === greens.yield)).toBe(true);
    run(sim, secs(30));
    expect(totalStock(sim, 'item.greens')).toBe(greens.yield);
    expect(plotOf(sim, bed)).toMatchObject({ planted: 'crop.greens', ready: false });
  }, 300000);

  it('the large bed is three times the small one yield', () => {
    const { sim } = farmGame();
    const large = bedAt(sim, 'module.hydroponics_large');
    const greens = content.crops['crop.greens'];
    sim.enqueue({ type: 'plot.setCrop', moduleId: large, crop: 'crop.greens' });
    run(sim, secs(40));
    const grown = run(sim, secs(greens.growSec));
    expect(grown.some((e) => e.type === 'crop.harvested' && e.count === greens.yield * 3)).toBe(true);
  }, 300000);
});
