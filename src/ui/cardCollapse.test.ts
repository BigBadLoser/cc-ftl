import { describe, expect, it } from 'vitest';
import { collapseKey, readCollapsed, writeCollapsed } from './cardCollapse';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('card collapse state', () => {
  it('starts expanded and remembers each card on its own', () => {
    const s = mem();
    expect(readCollapsed('goals', () => s)).toBe(false);
    writeCollapsed('goals', true, () => s);
    expect(s.getItem(collapseKey('goals'))).toBe('1');
    expect(readCollapsed('goals', () => s)).toBe(true);
    expect(readCollapsed('jobs', () => s)).toBe(false);
    writeCollapsed('goals', false, () => s);
    expect(readCollapsed('goals', () => s)).toBe(false);
  });
  it('stays expanded and does not throw when storage is unavailable', () => {
    const broken = () => { throw new Error('blocked'); };
    expect(readCollapsed('goals', broken)).toBe(false);
    expect(() => writeCollapsed('goals', true, broken)).not.toThrow();
  });
});
