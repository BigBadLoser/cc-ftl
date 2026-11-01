import { describe, expect, it } from 'vitest';
import spritePipe from '../../node_modules/pixi.js/lib/scene/sprite/SpritePipe.mjs?raw';
import abstractRenderer from '../../node_modules/pixi.js/lib/rendering/renderers/shared/system/AbstractRenderer.mjs?raw';

/** `setRounding` in scene.ts writes into Pixi internals; this fails when an upgrade renames them. */
describe('pixi internals used by scene.ts setRounding', () => {
  it('SpritePipe keeps a _gpuSpriteHash of batchables with a roundPixels field', () => {
    expect(spritePipe).toContain('this._gpuSpriteHash =');
    expect(spritePipe).toContain('batchableSprite.roundPixels = this._renderer._roundPixels');
  });
  it('the renderer keeps a _roundPixels flag', () => {
    expect(abstractRenderer).toContain('this._roundPixels');
  });
});
