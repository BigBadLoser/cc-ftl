import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { Sim } from '../sim';
import { shipGrid } from '../regions';
import { Struct, writeStruct } from '../structure';
import { archiveSector, restoreArchive } from '../sector/archive';
import { findPath } from './pathfind';

function sim(rows: string[]): Sim {
  const s = new Sim(1);
  stampShip(s, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  return s;
}

describe('findPath', () => {
  it('walks straight and diagonally in open floor', () => {
    const s = sim(['_____', '_____', '_____']);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 4, y: 0 })).toHaveLength(4);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    expect(findPath(s, 1, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });
  it('goes around obstacles', () => {
    const s = sim(['___', '##_', '___']);
    const p = findPath(s, 1, { x: 0, y: 0 }, { x: 0, y: 2 }) ?? [];
    expect(p.map((t) => `${t.x},${t.y}`)).toEqual(['1,0', '2,0', '2,1', '2,2', '1,2', '0,2']);
  });
  it('passes through doors', () => {
    const s = sim(['_#_', '_D_', '_#_']);
    const p = findPath(s, 1, { x: 0, y: 1 }, { x: 2, y: 1 });
    expect(p).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
  });
  it('returns null when unreachable or goal is solid', () => {
    const s = sim(['_#_', '_#_']);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(findPath(s, 9, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeNull();
  });
  it('does not cut corners', () => {
    const s = sim(['_#', '#_']);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
    const t = sim(['__', '#_']);
    expect(findPath(t, 1, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 0 }, { x: 1, y: 1 }]);
  });
  it('adjacency goal stops next to a wall', () => {
    const s = sim(['____#', '____#']);
    const p = findPath(s, 1, { x: 0, y: 0 }, { x: 4, y: 0, adjacent: true }) ?? [];
    expect(p[p.length - 1]).toEqual({ x: 3, y: 0 });
    expect(findPath(s, 1, { x: 3, y: 1 }, { x: 4, y: 0, adjacent: true })).toEqual([]);
  });
  it('is deterministic', () => {
    const s = sim(['______', '______', '______']);
    const a = findPath(s, 1, { x: 0, y: 0 }, { x: 5, y: 2 });
    const b = findPath(s, 1, { x: 0, y: 0 }, { x: 5, y: 2 });
    expect(a).toEqual(b);
  });
  it('forgets an unreachable result when the map changes (a remembered failure never outlives a wall, a door or a jam)', () => {
    const s = sim(['_#_', '_#_']);
    const grid = shipGrid(s, 1)!;
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull(); // answered from memory
    writeStruct(grid, 1, 0, Struct.Floor);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(2);
    writeStruct(grid, 1, 0, Struct.Wall);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });
  it('a remembered failure never carries over to a restored archive (a new grid whose revisions start again at zero)', () => {
    const s = sim(['_#_', '_#_']);
    const node = s.sector.node;
    archiveSector(s);
    restoreArchive(s, node);
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull(); // remembered under the restored grid's revisions
    writeStruct(shipGrid(s, 1)!, 1, 0, Struct.Floor);
    archiveSector(s);
    restoreArchive(s, node); // the corridor is open now, and the new grid's revisions are back at zero
    expect(findPath(s, 1, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(2);
  });
});
