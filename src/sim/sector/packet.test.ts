import { describe, expect, it } from 'vitest';
import { packetCount, packetTake, type ShipPacket } from './packet';

/** A 3x1 packet with two loose fuel stacks (ids 11, 12) and their item-grid ids. */
function packet(): ShipPacket {
  return {
    ship: 1, w: 3, h: 1,
    tiles: { item: [11, 12, 0] },
    entities: [
      { id: 11, c: { itemStack: { item: 'item.fuel', count: 2, x: 0, y: 0 } } },
      { id: 12, c: { itemStack: { item: 'item.fuel', count: 3, x: 1, y: 0 } } },
    ],
  };
}

describe('packetTake', () => {
  it('clears the item-grid id of a loose stack it empties', () => {
    const p = packet();
    expect(packetTake(p, 'item.fuel', 2)).toBe(2);
    expect(p.tiles['item']).toEqual([0, 12, 0]);
    expect(packetCount(p, 'item.fuel')).toBe(3);
    expect(packetTake(p, 'item.fuel', 9)).toBe(3);
    expect(p.tiles['item']).toEqual([0, 0, 0]);
    expect(p.entities).toHaveLength(0);
  });
});
