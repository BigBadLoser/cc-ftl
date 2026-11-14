import { describe, expect, it } from 'vitest';
import { slotOrder } from './stasisArt';

describe('stasis art', () => {
  it('draws the slots back to front, the hatch corner last at rotation 0', () => {
    const o = slotOrder(0);
    expect(o).toHaveLength(10);
    expect(o[o.length - 1]).toBe(0);
  });
});
