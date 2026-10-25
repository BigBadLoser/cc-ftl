import { describe, expect, it } from 'vitest';
import { artSize, portraitAssetId, portraitKey } from './portraitMath';

describe('portraitKey', () => {
  it('is stable and changes with each part of the look', () => {
    const k = portraitKey('species.human', 'role.medic', 7, undefined);
    expect(portraitKey('species.human', 'role.medic', 7, undefined)).toBe(k);
    for (const o of [portraitKey('species.robot', 'role.medic', 7, undefined), portraitKey('species.human', 'role.pilot', 7, undefined), portraitKey('species.human', 'role.medic', 8, undefined), portraitKey('species.human', 'role.medic', 7, 'rifle')]) expect(o).not.toBe(k);
  });
});

describe('portrait assets', () => {
  it('names the portrait of a layer', () => {
    expect(portraitAssetId('crew.human.hair.short')).toBe('portrait.crew.human.hair.short');
    expect(portraitAssetId('crew.robot.body.worker')).toBe('portrait.crew.robot.body.worker');
  });
  it('halves a world-px texture to whole art px', () => {
    expect(artSize(116, 124, 2)).toEqual({ w: 58, h: 62 });
    expect(artSize(1, 1, 2)).toEqual({ w: 1, h: 1 });
  });
});
