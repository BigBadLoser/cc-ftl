import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../sim/registry';
import { depthKey } from './iso';
import { moduleKey } from './moduleView';
import { cableDepth } from './cableView';

const def = { footprint: [3, 3], solid: true, groundMount: true } as unknown as ModuleDef;

describe('cable depth', () => {
  it("a cable tile draws after the mount from its front tile's depth on, before it behind", () => {
    const front = moduleKey(def, 12, 22);
    expect(depthKey(12, 22)).toBeGreaterThan(front);
    expect(depthKey(13, 21)).toBeGreaterThan(front);
    expect(depthKey(9, 21)).toBeLessThan(front);
  });

  it("a cable tile beside a piece's +x or +y face draws after it, one beside its -x or -y face before", () => {
    const pad = { footprint: [9, 9], solid: false, groundMount: true } as unknown as ModuleDef;
    const piece = { def: pad, x: 10, y: 20, rot: 0 };
    const front = moduleKey(pad, 18, 28);
    expect(cableDepth(19, 24, [piece])).toBeGreaterThan(front); // past +x, mid face: the bay's socket end
    expect(cableDepth(14, 29, [piece])).toBeGreaterThan(front); // past +y
    expect(cableDepth(20, 24, [piece])).toBe(depthKey(20, 24)); // two out: unchanged
    expect(cableDepth(9, 24, [piece])).toBe(depthKey(9, 24)); // past -x
    expect(cableDepth(9, 24, [piece])).toBeLessThan(front);
    expect(cableDepth(14, 19, [piece])).toBeLessThan(front); // past -y
  });

  it('a cable tile beside a landing pad keeps its own depth: the pad lies flat, sorted at its back tile', () => {
    const pad = { footprint: [9, 9], solid: false, groundMount: true, vehicleBay: { pad: true } } as unknown as ModuleDef;
    const piece = { def: pad, x: 10, y: 20, rot: 0 };
    expect(cableDepth(19, 24, [piece])).toBe(depthKey(19, 24));
    expect(cableDepth(14, 29, [piece])).toBe(depthKey(14, 29));
  });
});
