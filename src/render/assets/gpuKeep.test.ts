import { describe, expect, it, vi } from 'vitest';
import { ImageSource, TextureGCSystem } from 'pixi.js';
import { keepOnGpu } from './loader';

/**
 * Issue #102: crew and modules went invisible mid-game, their halos still drawn. Pixi's texture GC unloads image sources
 * nothing drew for `maxIdle` frames; the atlas has closed their bitmaps, so they never come back. Atlas sheets opt out.
 */
describe('atlas sheets and the texture GC', () => {
  function run(pin: boolean): boolean {
    const src = new ImageSource({ resource: { width: 4, height: 4 } as unknown as ImageBitmap });
    if (pin) keepOnGpu(src);
    const unload = vi.spyOn(src, 'unload');
    const renderer = { renderingToScreen: true, texture: { managedTextures: [src] } };
    const gc = new TextureGCSystem(renderer as never);
    gc.init({ textureGCActive: true, textureGCMaxIdle: 60, textureGCCheckCountMax: 10 } as never);
    src._touched = 0; // drawn once, at frame 0
    const frame = (gc as unknown as { postrender(): void }).postrender.bind(gc);
    for (let i = 0; i < 1000; i++) frame(); // then off screen for a long while
    return unload.mock.calls.length > 0;
  }

  it('unloads an idle image source by default (what blanked the sheets)', () => {
    expect(run(false)).toBe(true);
  });

  it('never unloads a sheet the atlas keeps on the GPU', () => {
    expect(run(true)).toBe(false);
  });
});
