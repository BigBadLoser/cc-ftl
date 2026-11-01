import { describe, expect, it } from 'vitest';
import { stationQuality } from './stationQuality';
import type { RoomRole } from './types';

/** Rooms A..D in a row along a corridor (room 4) below them, each with a door onto it. */
const rows = ['#########', '#_#_#_#_#', '#D#D#D#D#', '#_______#', '#########'];
const W = 9;
const roomOf = Int16Array.from({ length: W * rows.length }, (_, i) => {
  const x = i % W, y = Math.floor(i / W);
  if (rows[y]?.[x] !== '_') return -1;
  return y === 1 ? (x - 1) / 2 : 4;
});

describe('station quality', () => {
  it('scores near pairs met within two door steps and apart pairs kept further', () => {
    const roles: RoomRole[] = ['quarters', 'support', 'reactor', 'cargo', 'hall'];
    const q = stationQuality(rows, roomOf, roles);
    expect(q.pairs['quarters~support']).toBe(1); // two steps through the corridor
    expect(q.pairs['quarters/reactor']).toBe(0); // also two steps: too close
  });
  it('rates rooms of one district side by side above a random mix', () => {
    const together = stationQuality(['#########', '#___#___#', '#___#___#', '#########'], Int16Array.from({ length: 36 }, (_, i) => {
      const x = i % 9, y = Math.floor(i / 9);
      return y >= 1 && y <= 2 && x >= 1 && x <= 7 && x !== 4 ? (x < 4 ? 0 : 1) : -1;
    }), ['quarters', 'support']);
    expect(together.contacts).toBe(1);
    expect(together.clustering).toBe(1); // one district: as random
  });
});
