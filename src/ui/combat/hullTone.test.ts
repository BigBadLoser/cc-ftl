import { describe, expect, it } from 'vitest';
import { hullTone } from './hullTone';

describe('hullTone', () => {
  it('is green from 60%, amber from 30%, red below', () => {
    expect(hullTone(100)).toBe('green');
    expect(hullTone(60)).toBe('green');
    expect(hullTone(59)).toBe('amber');
    expect(hullTone(30)).toBe('amber');
    expect(hullTone(29)).toBe('red');
    expect(hullTone(0)).toBe('red');
  });
});
