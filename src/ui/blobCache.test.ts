import { describe, expect, it } from 'vitest';
import { createBlobCache } from './blobCache';

const setup = (max = 2) => {
  const revoked: string[] = [];
  return { revoked, cache: createBlobCache((u) => revoked.push(u), max) };
};

describe('blob cache', () => {
  it('keeps the last entries and revokes an evicted URL once', () => {
    const { cache, revoked } = setup();
    cache.put('a', 'u1');
    cache.put('b', 'u2');
    expect(revoked).toEqual([]);
    cache.put('c', 'u3');
    expect(revoked).toEqual(['u1']);
    expect(cache.get('a')).toBeNull();
    expect(cache.get('c')).toBe('u3');
  });

  it('revokes the old URL when a key is replaced', () => {
    const { cache, revoked } = setup();
    cache.put('a', 'u1');
    cache.put('a', 'u2');
    cache.put('a', 'u2');
    expect(revoked).toEqual(['u1']);
  });

  it('never revokes the URL on screen, and revokes it once it is replaced on screen', () => {
    const { cache, revoked } = setup(1);
    cache.put('a', 'u1');
    cache.show('u1');
    cache.put('b', 'u2');
    expect(revoked).toEqual([]);
    cache.show('u2');
    expect(revoked).toEqual(['u1']);
    cache.show('u2');
    cache.show(null);
    expect(revoked).toEqual(['u1']);
  });

  it('keeps a shown URL that is still cached on close, and disposes each URL exactly once overall', () => {
    const { cache, revoked } = setup();
    cache.put('a', 'u1');
    cache.show('u1');
    cache.show(null);
    expect(revoked).toEqual([]);
    cache.put('b', 'u2');
    cache.put('c', 'u3');
    cache.put('d', 'u4');
    expect(revoked.sort()).toEqual(['u1', 'u2']);
  });
});
