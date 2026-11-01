import { describe, expect, it } from 'vitest';
import { recallReason } from './boardingText';

describe('recall reasons', () => {
  it('names the known reasons and falls back for new ones', () => {
    expect(recallReason('full')).toBe('found the shuttle full');
    expect(recallReason('somethingNew')).toBe('could not be recalled');
  });
});
