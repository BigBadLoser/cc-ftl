import { describe, expect, it } from 'vitest';
import { SectorGrid } from './sectorGrid';
import { ShipGrid } from './shipGrid';
import { snapshot, thinMask } from './gridSnapshot';
import { SHIP_EMPTY, SHIP_FIELDS, Struct } from './structure';
import { EVA_THIN_AIR_BELOW } from './tuning';

const mk = (watch = true): { sector: SectorGrid; ship: ShipGrid } => {
  const sector = new SectorGrid(1, SHIP_FIELDS, SHIP_EMPTY, watch ? { watch: { field: 'o2', below: EVA_THIN_AIR_BELOW } } : {});
  for (let x = 2; x < 40; x++) for (let y = 3; y < 20; y++) sector.set('struct', x, y, Struct.Floor);
  for (let x = 2; x < 20; x++) for (let y = 3; y < 20; y++) sector.set('o2', x, y, 21);
  return { sector, ship: new ShipGrid(9, sector, 2, 3, 38, 17) };
};
const mask = (ship: ShipGrid): number[] => [...ship.load('o2')].map((v) => (v < EVA_THIN_AIR_BELOW ? 1 : 0));

describe('grid snapshots', () => {
  it('a snapshot is the loaded field, shared until a tile under the ship is written', () => {
    const { sector, ship } = mk();
    const a = snapshot(ship, 'struct');
    expect([...a]).toEqual([...ship.load('struct')]);
    expect(snapshot(ship, 'struct')).toBe(a);
    sector.set('struct', 70, 70, Struct.Wall); // far off the ship: a chunk it does not overlap
    expect(snapshot(ship, 'struct')).toBe(a);
    sector.set('struct', 5, 5, Struct.Wall);
    const b = snapshot(ship, 'struct');
    expect(b).not.toBe(a);
    expect([...b]).toEqual([...ship.load('struct')]);
  });

  it('the thin-air mask follows only writes across the line, and matches the field', () => {
    const { sector, ship } = mk();
    const m = thinMask(ship);
    expect([...m.thin]).toEqual(mask(ship));
    sector.set('o2', 4, 4, 15); // breathable to breathable: no crossing, the same mask
    expect(thinMask(ship)).toBe(m);
    sector.set('o2', 4, 4, 1); // across the line
    const n = thinMask(ship);
    expect(n).not.toBe(m);
    expect([...n.thin]).toEqual(mask(ship));
    expect(n.hash).not.toBe(m.hash);
  });

  it('without the watch the mask follows the o2 revision', () => {
    const { sector, ship } = mk(false);
    const m = thinMask(ship);
    sector.set('o2', 4, 4, 15);
    const n = thinMask(ship);
    expect(n).not.toBe(m);
    expect(n.hash).toBe(m.hash);
    expect([...n.thin]).toEqual(mask(ship));
  });
});
