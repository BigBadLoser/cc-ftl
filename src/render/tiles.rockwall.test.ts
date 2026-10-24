import { describe, expect, it } from 'vitest';
import { Struct } from '../sim/structure';
import { wallPieces } from './tiles';

describe('rock walls', () => {
  it('pick the metal wall pieces with the tile.rockwall prefix', () => {
    const kindAt = (x: number, y: number) => (y === 0 && x >= 0 && x <= 2 ? Struct.RockWall : Struct.Floor);
    const rock = wallPieces(kindAt, 1, 0, Struct.RockWall, 'auto')[0]?.chain ?? [];
    const metal = wallPieces((x, y) => (y === 0 && x >= 0 && x <= 2 ? Struct.Wall : Struct.Floor), 1, 0, Struct.Wall, 'up')[0]?.chain ?? [];
    expect(rock[0]).toBe('tile.rockwall.m10');
    expect(rock.every((id) => id.startsWith('tile.rockwall.'))).toBe(true);
    expect(metal.map((id) => id.replace('tile.wall.', 'tile.rockwall.'))).toEqual(
      wallPieces(kindAt, 1, 0, Struct.RockWall, 'up')[0]?.chain,
    );
  });
});
