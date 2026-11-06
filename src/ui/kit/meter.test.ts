import { describe, expect, it } from 'vitest';
import { meterTone } from './meterTone';

describe('meterTone', () => {
  it('follows the 60/30 hull rule by default', () => {
    expect(meterTone(100)).toBe('good');
    expect(meterTone(60)).toBe('good');
    expect(meterTone(59)).toBe('warn');
    expect(meterTone(30)).toBe('warn');
    expect(meterTone(29)).toBe('bad');
  });
  it('takes the caller own cut-offs', () => {
    const t = { good: 80, warn: 50 };
    expect(meterTone(79, t)).toBe('warn');
    expect(meterTone(49, t)).toBe('bad');
  });
});
