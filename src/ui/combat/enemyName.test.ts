import { describe, expect, it } from 'vitest';
import { cardName } from './enemyName';

describe('enemy card name', () => {
  it('drops the faction and class words the subtitle already shows', () => {
    expect(cardName('Navy frigate NA-0005', 'Navy', 'Frigate')).toBe('NA-0005');
    expect(cardName('Free traders liner FR-1A2B', 'Free traders', 'Liner')).toBe('FR-1A2B');
  });
  it('keeps names that do not repeat the subtitle, and never empties a name', () => {
    expect(cardName('Raider', 'Hostile', null)).toBe('Raider');
    expect(cardName('Trade station hub C3AA', 'Neutral', 'Hub')).toBe('Trade station hub C3AA');
    expect(cardName('Navy', 'Navy', null)).toBe('Navy');
  });
});
