import { describe, expect, it } from 'vitest';
import { Container, type Rectangle } from 'pixi.js';
import { createPaintAtlas } from './paintAtlas';

const overlap = (a: Rectangle, b: Rectangle): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('paint atlas', () => {
  it('builds each distinct paint once and shares its cell', () => {
    const atlas = createPaintAtlas();
    let made = 0;
    const make = () => (made++, new Container());
    const a = atlas.sprite('a', 30, 20, make);
    const b = atlas.sprite('a', 30, 20, make);
    const c = atlas.sprite('c', 30, 20, make);
    expect(made).toBe(2);
    expect(atlas.cells).toBe(2);
    expect(a.texture).toBe(b.texture);
    expect(a.texture.frame.width).toBe(30);
    expect(a.texture.frame.height).toBe(20);
    expect(overlap(a.texture.frame, c.texture.frame)).toBe(false);
    expect(a.texture.source).toBe(c.texture.source);
  });

  it('repacks into a bigger texture when full, keeping the live paints and dropping the unused', () => {
    const atlas = createPaintAtlas();
    const keep = Array.from({ length: 40 }, (_, i) => atlas.sprite(`k${i}`, 200, 60, () => new Container()));
    const gone = Array.from({ length: 40 }, (_, i) => atlas.sprite(`g${i}`, 200, 60, () => new Container()));
    for (const s of gone) s.destroy();
    // Enough new paints to overflow the first texture.
    const more = Array.from({ length: 200 }, (_, i) => atlas.sprite(`m${i}`, 200, 60, () => new Container()));
    expect(atlas.cells).toBeLessThan(40 + 40 + 200);
    const live = [...keep, ...more];
    const src = live[0]!.texture.source;
    for (const s of live) expect(s.texture.source).toBe(src);
    const frames = live.map((s) => s.texture.frame);
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]!;
      expect(f.x + f.width).toBeLessThanOrEqual(src.width);
      expect(f.y + f.height).toBeLessThanOrEqual(src.height);
      for (let j = i + 1; j < frames.length; j++) expect(overlap(f, frames[j]!)).toBe(false);
    }
  });
});
