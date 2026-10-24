import { describe, expect, it } from 'vitest';
import { ByteBudget } from './budget';

describe('ByteBudget', () => {
  it('has no victims while under the limit', () => {
    const b = new ByteBudget(100);
    b.add('a', 60, 1);
    b.add('b', 40, 2);
    expect(b.resident).toBe(100);
    expect(b.victims(10)).toEqual([]);
  });
  it('offers least recently used first, only as many as needed', () => {
    const b = new ByteBudget(100);
    b.add('a', 50, 1);
    b.add('b', 50, 2);
    b.add('c', 50, 3);
    b.touch('a', 4);
    expect(b.victims(10)).toEqual(['b']);
    b.add('d', 100, 5);
    expect(b.victims(10)).toEqual(['b', 'c', 'a']);
  });
  it('never offers pinned or recently used entries', () => {
    const b = new ByteBudget(10);
    b.add('core', 50, 0, true);
    b.add('hot', 50, 9);
    b.add('cold', 50, 1);
    expect(b.victims(5)).toEqual(['cold']);
  });
  it('tracks the total through replace and remove', () => {
    const b = new ByteBudget(100);
    b.add('a', 30, 0);
    b.add('a', 50, 0);
    expect(b.resident).toBe(50);
    b.remove('a');
    b.remove('a');
    expect(b.resident).toBe(0);
  });
  it('touch never moves an entry back in time', () => {
    const b = new ByteBudget(1);
    b.add('a', 10, 5);
    b.touch('a', 2);
    expect(b.entries.get('a')?.lastUse).toBe(5);
  });
});
