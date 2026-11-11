import { describe, expect, it } from 'vitest';
import { describeChanges } from './changes';
import { addModule, paint, type Layout, type Tile } from './layout';
import { kindOf, liverySwatch, originText, renameShip, resizeGrid, setFaction, setKind } from './ship';
import { blankLayout, buildLayout, DEFAULT_SOURCE, sideOf } from './source';

const rect = (x: number, y: number, w: number, h: number): Tile[] => { const t: Tile[] = []; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) t.push([i, j]); return t; };
const ok = (r: ReturnType<typeof resizeGrid>): Layout => { if ('error' in r) throw new Error(r.error); return r.layout; };

describe('ship settings', () => {
  it('rename and kind change one field and return the same layout when nothing changes', () => {
    const l = blankLayout(20, 20);
    expect(renameShip(l, 'Blank')).toBe(l);
    expect(renameShip(l, ' Wayfarer ').name).toBe('Wayfarer');
    expect(setKind(l, 'station')).toBe(l); // a blank grid is immobile already
    const ship = setKind(l, 'ship');
    expect(ship.immobile).toBe(false);
    expect(kindOf(ship)).toBe('ship');
    expect(setKind(ship, 'ship')).toBe(ship);
  });
  it('a faction on a blank grid creates the origin with the game side; none removes it', () => {
    const l = blankLayout(20, 20);
    const f = setFaction(l, 'faction.civilian');
    expect(f.origin).toEqual({ gen: { faction: 'faction.civilian', seed: 1, depth: 0 }, side: sideOf('faction.civilian') });
    expect(setFaction(f, 'faction.civilian')).toBe(f);
    const navy = setFaction(f, 'faction.navy');
    expect(navy.origin?.side).toBe(sideOf('faction.navy'));
    expect(navy.origin?.gen).toMatchObject({ faction: 'faction.navy', seed: 1 });
    expect(setFaction(navy, null).origin).toBeUndefined();
    expect(originText(f)).toBe('');
    expect(setFaction(l, null)).toBe(l);
  });
  it('an import keeps its seed, depth and role when the faction changes, and the swatch reads the faction livery', () => {
    const { layout } = buildLayout({ ...DEFAULT_SOURCE, kind: 'faction', id: 'faction.civilian', family: 'freighter', seed: 3, depth: 2 });
    const navy = setFaction(layout, 'faction.navy');
    expect(navy.origin?.gen).toMatchObject({ faction: 'faction.navy', seed: 3, depth: 2 });
    expect(originText(layout)).toMatch(/^civilian:.* · seed 3 · depth 2$/);
    expect(liverySwatch('faction.civilian')[0]).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('grows and shrinks from the bottom-right, keeping tiles and rooms where they are', () => {
    const l = paint(blankLayout(20, 20), rect(3, 3, 4, 4), '_');
    const big = ok(resizeGrid(l, 30, 25));
    expect([big.width, big.height, big.cells.length, big.roomOf.length]).toEqual([30, 25, 25, 750]);
    expect(big.cells[4]?.slice(3, 7)).toBe('____');
    const back = ok(resizeGrid(big, 20, 20));
    expect(back.cells).toEqual(l.cells);
    expect(back.roomOf).toEqual(l.roomOf);
  });
  it('refuses a shrink that would cut tiles or a module, with the reason, and a size out of range', () => {
    const l = addModule(paint(blankLayout(20, 20), rect(3, 3, 14, 4), '_'), { def: 'module.chair', x: 5, y: 4, rot: 0 });
    expect(resizeGrid(l, 10, 20)).toEqual({ error: 'Would cut off the ship at 10,3' });
    const cut = resizeGrid(addModule(blankLayout(20, 20), { def: 'module.console', x: 8, y: 2, rot: 0 }), 8, 20);
    expect('error' in cut && cut.error).toMatch(/cut off a module/);
    expect('error' in resizeGrid(l, 2, 20)).toBe(true);
    expect(ok(resizeGrid(l, 20, 20))).toBe(l);
    expect(ok(resizeGrid(l, 17, 7)).cells[3]?.length).toBe(17);
  });
  it('shows in the change list', () => {
    const l = blankLayout(20, 20);
    const edited = resizeGrid(setKind(setFaction(renameShip(l, 'Hauler'), 'faction.civilian'), 'ship'), 24, 20);
    const out = describeChanges(l, ok(edited));
    expect(out).toEqual(expect.arrayContaining([expect.stringMatching(/Renamed/), expect.stringMatching(/Made it a ship/), expect.stringMatching(/faction to civilian/), expect.stringMatching(/Resized the grid from 20 x 20 to 24 x 20/)]));
  });
});
