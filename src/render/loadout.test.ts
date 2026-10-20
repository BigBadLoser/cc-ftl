import { describe, expect, it } from 'vitest';
import type { ClipDef, LayerAsset } from './assets/manifest';
import { resolveClip } from './loadout';

const clip = (sheet: string): ClipDef => ({ sheet, start: 0, frames: 4, fps: 4, loop: true });
const layer = (names: string[]): LayerAsset => ({
  kind: 'crew.layer', species: 'human', slot: 'torso', order: 30, frameW: 1, frameH: 1, anchor: { x: 0, y: 0 },
  clips: Object.fromEntries(names.map((n) => [n, clip(`s.${n}`)])),
});

describe('resolveClip', () => {
  it('plays the requested clip when the layer has it', () => {
    expect(resolveClip(layer(['idle', 'walk']), 'walk')?.sheet).toBe('s.walk');
  });
  it('falls back to idle for a clip the layer lacks (eva_float on an item without it)', () => {
    expect(resolveClip(layer(['idle', 'walk']), 'eva_float')?.sheet).toBe('s.idle');
  });
  it('hides a layer without sit sheets while seated, and sit_work falls back to sit_idle', () => {
    expect(resolveClip(layer(['idle']), 'sit_idle')).toBeUndefined();
    expect(resolveClip(layer(['idle']), 'sit_work')).toBeUndefined();
    expect(resolveClip(layer(['idle', 'sit_idle']), 'sit_work')?.sheet).toBe('s.sit_idle');
  });
  it('is undefined for a layer with no clips at all', () => {
    expect(resolveClip(layer([]), 'idle')).toBeUndefined();
  });
});
