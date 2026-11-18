import { describe, expect, it } from 'vitest';
import { decodeLayout, encodeLayout, parseCase, serializeCase, caseOf, type Provenance } from './cases';
import { commit, fresh, live, undo } from './history';
import { paint, type Layout } from './layout';
import { DEFAULT_SOURCE, blankLayout, specOf } from './source';
import { addWindow, removeWindowAt, windowIndexAt, windowsOf } from './windows';
import { buildWorld, windowPlanAt } from './world';
import { shipGrid } from '../../src/sim/regions';
import { windowAt, windowCode } from '../../src/sim/windows';
import { ORIGIN } from './camera';

/** A 12x8 ship: a room with a partition along y at x = 6 and a hull of walls (floor ringed by '#'). */
function ship(): Layout {
  let l = blankLayout(16, 12);
  const floor: [number, number][] = [];
  for (let y = 3; y < 9; y++) for (let x = 3; x < 13; x++) floor.push([x, y]);
  l = paint(l, floor, '_');
  const wall: [number, number][] = [];
  for (let y = 4; y < 8; y++) wall.push([8, y]);
  return paint(l, wall, '#');
}
const prov = (): Provenance => ({ ...DEFAULT_SOURCE, kind: 'blank', spec: specOf({ ...DEFAULT_SOURCE, kind: 'blank' }), generator: 'x' });

describe('layout windows (#516)', () => {
  it('adds a run, finds it by any tile and removes it', () => {
    const l = addWindow(ship(), { x: 8, y: 4, axis: 'y', size: 3 });
    expect(windowsOf(l)).toHaveLength(1);
    expect(windowIndexAt(l, 8, 6)).toBe(0);
    expect(windowIndexAt(l, 8, 7)).toBe(-1);
    expect(addWindow(l, { x: 8, y: 4, axis: 'y', size: 3 })).toBe(l);
    expect(removeWindowAt(l, 8, 5).windows).toBeUndefined();
  });
  it('painting over a window tile with another kind drops that window, other paint keeps it', () => {
    const l = addWindow(ship(), { x: 8, y: 4, axis: 'y', size: 3 });
    expect(windowsOf(paint(l, [[5, 5]], '#'))).toHaveLength(1);
    expect(windowsOf(paint(l, [[8, 5]], 'D'))).toHaveLength(0);
    expect(windowsOf(paint(l, [[8, 6]], '_'))).toHaveLength(0);
  });
  it('is one undo step', () => {
    const l = ship();
    const h = commit(live(fresh(l), addWindow(l, { x: 8, y: 4, axis: 'y', size: 2 })), l);
    expect(undo(h).present.windows).toBeUndefined();
  });
  it('plans with the game rules: straight wall yes, floor and a corner no', () => {
    const l = ship();
    const ok = windowPlanAt(l, 8, 5, 3);
    expect(ok?.error).toBeNull();
    expect(ok?.axis).toBe('y');
    expect(ok?.tiles).toHaveLength(3);
    expect(windowPlanAt(l, 5, 5, 2)?.error).toBe('notWall');
    expect(windowPlanAt(l, 8, 3, 2)?.error).toBe('notStraight'); // the T-junction where the partition meets the hull
    expect(windowPlanAt(addWindow(l, { x: 8, y: 4, axis: 'y', size: 3 }), 8, 5, 2)?.error).toBe('hasWindow');
  });
  it('round-trips through a case file, and an older file has none', () => {
    const l = addWindow(ship(), { x: 8, y: 5, axis: 'y', size: 2 });
    const back = parseCase(serializeCase(caseOf('w', prov(), ship(), l, [], [])));
    expect(decodeLayout(back.edited).windows).toEqual([{ x: 8, y: 5, axis: 'y', size: 2 }]);
    expect(decodeLayout(back.original).windows).toBeUndefined();
    expect(encodeLayout(ship())).not.toHaveProperty('windows');
  });
  it('stamps each tile code into the ship the preview renders', () => {
    const l = addWindow(addWindow(ship(), { x: 8, y: 4, axis: 'y', size: 3 }), { x: 4, y: 3, axis: 'x', size: 2 });
    const w = buildWorld(l);
    const grid = w ? w.sim.sector.grid : null;
    expect(w).not.toBeNull();
    const g = w as NonNullable<typeof w>;
    const at = (x: number, y: number) => g.sim.sector.grid && windowAt(shipOf(g), ORIGIN + x, ORIGIN + y);
    expect(grid).toBeTruthy();
    expect(shipOf(g).get('window', ORIGIN + 8, ORIGIN + 4)).toBe(windowCode('y', 3, 0));
    expect(shipOf(g).get('window', ORIGIN + 8, ORIGIN + 6)).toBe(windowCode('y', 3, 2));
    expect(shipOf(g).get('window', ORIGIN + 5, ORIGIN + 3)).toBe(windowCode('x', 2, 1));
    expect(at(8, 8)).toBeNull();
  });
});
import type { World } from './world';
const shipOf = (w: World) => shipGrid(w.sim, w.ship) as NonNullable<ReturnType<typeof shipGrid>>;
