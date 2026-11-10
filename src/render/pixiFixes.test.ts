import { describe, expect, it } from 'vitest';
import { BindGroup, TextureSource } from 'pixi.js';
import { applyPixiFixes } from './pixiFixes';

/**
 * Issue #406: after a jump, opening the starmap threw `Cannot read properties of null (reading '_resourceId')`. A bind group
 * whose texture was destroyed holds nulls, Pixi keeps it, and a later change of a sampler it still listened to rebuilt its key.
 */
describe('pixi bind group backports', () => {
  applyPixiFixes();
  const src = (): TextureSource => new TextureSource({ width: 4, height: 4 });

  it('a sampler change after a shared texture was destroyed does not throw', () => {
    const live = src();
    const gone = src();
    const group = new BindGroup({ 0: gone, 1: gone.style, 2: live, 3: live.style });
    gone.destroy();
    expect(group.resources[0]).toBeNull();
    expect(group.resources[1]).toBeNull();
    live.style.addressMode = 'repeat';
    expect(() => live.style.update()).not.toThrow();
    expect(() => live.resize(8, 8)).not.toThrow();
  });

  it('swapping a resource stops listening to the old one', () => {
    const first = src();
    const second = src();
    const group = new BindGroup({ 0: first, 1: first.style });
    group.setResource(second, 0);
    group.setResource(second.style, 1);
    expect(first.style.listenerCount('change')).toBe(1); // only its own source
    expect(second.style.listenerCount('change')).toBe(2);
    first.destroy();
    expect(group.resources[0]).toBe(second);
  });
});
