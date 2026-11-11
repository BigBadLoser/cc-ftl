import { describe, expect, it } from 'vitest';
import { describeChanges } from './changes';
import { addModule, addRoom, moveModule, paint, removeModule, resizeRoom, rotateModule, setRole, type Layout, type Tile } from './layout';
import { blankLayout } from './source';

const rect = (x: number, y: number, w: number, h: number): Tile[] => { const t: Tile[] = []; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) t.push([i, j]); return t; };
const two = (): { l: Layout; hangar: number } => {
  const a = addRoom(blankLayout(40, 30), { x: 10, y: 12, w: 8, h: 6 }, 'hangar');
  return { l: addModule(a.layout, { def: 'module.console', x: 12, y: 14, rot: 0 }), hangar: a.id };
};

describe('change list', () => {
  it('says nothing when nothing changed', () => {
    const { l } = two();
    expect(describeChanges(l, l)).toEqual([]);
  });
  it('groups added floor into a region placed beside the nearest room', () => {
    const { l } = two();
    const out = describeChanges(l, paint(l, rect(11, 6, 4, 3), '_'));
    expect(out).toEqual(['Added 12 floor tiles north of the hangar']);
  });
  it('places an edit that lands inside a room "in" it, and splits separate regions', () => {
    const { l } = two();
    const out = describeChanges(l, paint(paint(l, [[15, 16]], '#'), rect(19, 13, 2, 2), '_'));
    expect(out).toContain('Turned 1 floor tile into wall in the hangar');
    expect(out.some((s) => s.startsWith('Added 4 floor tiles east of the hangar'))).toBe(true);
  });
  it('names door changes by tile', () => {
    const { l } = two();
    const withDoor = paint(l, [[14, 17]], 'D');
    expect(describeChanges(l, withDoor)).toEqual(['Added a door at (14,17)']);
    expect(describeChanges(withDoor, l)).toEqual(['Turned 1 wall tile into floor in the hangar'.replace('Turned 1 wall tile into floor in the hangar', 'Removed the door at (14,17)')]);
  });
  it('words module moves, turns, additions and removals with the module code', () => {
    const { l } = two();
    expect(describeChanges(l, moveModule(l, 0, 14, 14, 0))).toEqual(['Moved console CO from (12,14) to (14,14)']);
    expect(describeChanges(l, rotateModule(l, 0))).toEqual(['Turned console CO at (12,14) from 0 to 90 deg']);
    expect(describeChanges(l, removeModule(l, 0))).toEqual(['Removed console CO from (12,14) in the hangar']);
    expect(describeChanges(l, addModule(l, { def: 'module.console', x: 15, y: 15, rot: 0 }))).toEqual(['Added console CO at (15,15) in the hangar']);
  });
  it('a module keeps its identity when others are removed before it', () => {
    const { l } = two();
    const more = addModule(l, { def: 'module.console', x: 16, y: 13, rot: 0 });
    const edited = moveModule(removeModule(more, 0), 0, 17, 13, 0);
    expect(describeChanges(more, edited)).toEqual(['Moved console CO from (16,13) to (17,13)', 'Removed console CO from (12,14) in the hangar']);
  });
  it('words room retypes and resizes', () => {
    const { l, hangar } = two();
    expect(describeChanges(l, setRole(l, hangar, 'cargo'))).toEqual([`Retyped room ${hangar} hangar → cargo`]);
    const wider = resizeRoom(l, hangar, { x: 10, y: 12, w: 10, h: 6 });
    expect(describeChanges(l, wider)[0]).toBe(`Resized room ${hangar} hangar from 8 x 6 at (10,12) to 10 x 6 at (10,12)`);
  });
  it('a drawn room is one line: its floor and wall ring are not listed again', () => {
    const l = blankLayout(40, 30);
    const made = addRoom(l, { x: 10, y: 8, w: 5, h: 4 }, 'cabin');
    expect(describeChanges(l, made.layout)).toEqual([`Added room ${made.id} cabin, 5x4 at (10,8)`]);
    // edits beside the new room still read as tile lines
    const more = paint(made.layout, rect(20, 8, 2, 2), '_');
    expect(describeChanges(l, more)).toHaveLength(2);
  });
  it('adds an unnamed distance as plain coordinates when no room is near', () => {
    const l = blankLayout(60, 40);
    expect(describeChanges(l, paint(l, rect(30, 30, 2, 2), '_'))).toEqual(['Added 4 floor tiles around (31,31)']);
  });
});

describe('beam edits', () => {
  const withBeam = (l: Layout, x: number, y: number, ch: string): Layout => ({ ...l, cells: l.cells.map((r, j) => (j === y ? `${r.slice(0, x)}${ch}${r.slice(x + 1)}` : r)) });
  it('are listed: added, removed and turned into floor or wall', () => {
    const { l } = two();
    const beam = withBeam(l, 30, 5, '=');
    expect(describeChanges(l, beam)[0]).toMatch(/^Added 1 beam tile/);
    expect(describeChanges(beam, l)[0]).toMatch(/^Removed 1 beam tile/);
    expect(describeChanges(beam, withBeam(l, 30, 5, '_'))[0]).toMatch(/^Turned 1 beam tile into floor/);
    expect(describeChanges(beam, withBeam(l, 30, 5, '#'))[0]).toMatch(/^Turned 1 beam tile into wall/);
  });
});
