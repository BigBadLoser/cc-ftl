import { describe, expect, it } from 'vitest';
import { newGalaxy } from './state';
import { edgeBetween, planStarRoute } from './route';
import type { EdgeData, GalaxyState, NodeData } from './types';

const node = (id: string): NodeData => ({ id, sector: 's.0.0', x: 0, y: 0, name: id, danger: 0, faction: null, structures: [], resources: [], contacts: [] });
const edge = (a: string, b: string, fuel: number, time: number): EdgeData => ({ id: `r:${a}|${b}`, a, b, kind: 'route', length: 1, fuel, charge: 10, time });

function fixture(): GalaxyState {
  const g = newGalaxy(1);
  g.current = 'a';
  g.chunks['0,0'] = {
    key: '0,0', cx: 0, cy: 0, sectors: [], nodes: ['a', 'b', 'c', 'd', 'e'].map(node),
    edges: [edge('a', 'b', 1, 5), edge('b', 'd', 1, 5), edge('a', 'c', 1, 1), edge('c', 'd', 1, 1), edge('a', 'd', 3, 0.5), edge('d', 'e', 1, 1)],
  };
  for (const id of ['a', 'b', 'c', 'd']) g.discovered[id] = 0;
  return g;
}

describe('route planning', () => {
  it('takes the least fuel, breaking ties on travel time', () => {
    const r = planStarRoute(fixture(), 'a', 'd');
    expect(r?.path).toEqual(['a', 'c', 'd']);
    expect(r).toMatchObject({ fuel: 2, time: 2, charge: 20 });
  });

  it('keeps to discovered nodes unless told otherwise', () => {
    const g = fixture();
    expect(planStarRoute(g, 'a', 'e')).toBeNull();
    expect(planStarRoute(g, 'a', 'e', { known: false })?.path).toEqual(['a', 'c', 'd', 'e']);
  });

  it('finds direct edges and nothing for unknown nodes', () => {
    const g = fixture();
    expect(edgeBetween(g, 'd', 'a')?.fuel).toBe(3);
    expect(edgeBetween(g, 'a', 'e')).toBeUndefined();
    expect(planStarRoute(g, 'a', 'zz')).toBeNull();
    expect(planStarRoute(g, 'a', 'a')).toMatchObject({ path: ['a'], fuel: 0 });
  });
});
