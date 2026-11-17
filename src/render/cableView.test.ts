import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../sim/registry';
import { depthKey } from './iso';
import { moduleKey } from './moduleView';

const def = { footprint: [3, 3], solid: true, groundMount: true } as unknown as ModuleDef;

describe('cable depth', () => {
  it("a cable tile draws after the mount from its front tile's depth on, before it behind", () => {
    const front = moduleKey(def, 12, 22);
    expect(depthKey(12, 22)).toBeGreaterThan(front);
    expect(depthKey(13, 21)).toBeGreaterThan(front);
    expect(depthKey(9, 21)).toBeLessThan(front);
  });
});
