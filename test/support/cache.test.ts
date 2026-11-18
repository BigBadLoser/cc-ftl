import { describe, expect, it } from 'vitest';
import { clearFileCaches, fileCache } from './cache';

describe('fileCache', () => {
  it('holds values until the per-file clear empties it', () => {
    const c = fileCache<string, number>();
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    clearFileCaches();
    expect(c.size).toBe(0);
  });
});
