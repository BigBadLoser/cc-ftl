import { describe, expect, it } from 'vitest';
import { boltAsset } from './shotLook';

describe('boltAsset', () => {
  const has = (id: string) => id === 'fx.laser_bolt_neutral';
  it('gives an upgraded shot its neutral bolt when the art has one', () => {
    expect(boltAsset('fx.laser_bolt', true, has)).toBe('fx.laser_bolt_neutral');
  });
  it('keeps the coloured bolt for a plain shot, and when there is no neutral one', () => {
    expect(boltAsset('fx.laser_bolt', false, has)).toBe('fx.laser_bolt');
    expect(boltAsset('fx.mass_slug', true, has)).toBe('fx.mass_slug');
  });
});
