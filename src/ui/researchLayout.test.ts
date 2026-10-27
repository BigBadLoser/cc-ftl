import { describe, expect, it } from 'vitest';
import type { UiResearchNode } from './api';
import { CHILD_GUTTER, COL, NODE_H, NODE_W, PAD_X, ROW, TRUNK_GUTTER, layoutResearch, type Link, type PlacedNode } from './researchLayout';

const node = (id: string, band: string, parents: string[], status: UiResearchNode['status'] = 'open', extra: Partial<UiResearchNode> = {}): UiResearchNode => ({
  id, name: id, band, parents, project: parents.length > 0, status, pos: null, module: id, sub: '', stats: [], cost: [], seconds: 0, progress: 0, ...extra,
});
const bands = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
const find = (l: ReturnType<typeof layoutResearch>, id: string): PlacedNode => l.nodes.find((p) => p.node.id === id) as PlacedNode;
const link = (l: ReturnType<typeof layoutResearch>, from: string, to: string): Link => l.links.find((k) => k.from === from && k.to === to) as Link;

/** True when an orthogonal segment crosses the node's box. */
function hits(points: Link['points'], n: PlacedNode): boolean {
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1] as [number, number];
    const [bx, by] = points[i] as [number, number];
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    if (x1 > n.x && x0 < n.x + NODE_W && y1 > n.y && y0 < n.y + NODE_H) return true;
  }
  return false;
}

describe('research layout: placement', () => {
  it('puts prerequisites left and unlocks right, a column step apart', () => {
    const t = layoutResearch([node('r', 'a', [], 'known'), node('m2', 'a', ['r'], 'known'), node('m3', 'a', ['m2'])], bands);
    expect([find(t, 'r').x, find(t, 'm2').x, find(t, 'm3').x]).toEqual([PAD_X, PAD_X + COL, PAD_X + 2 * COL]);
  });

  it('stacks siblings in rows, bands one under the other, and honours col and row overrides', () => {
    const t = layoutResearch([node('r', 'a', [], 'known'), node('x', 'a', ['r']), node('y', 'a', ['r'], 'open', { col: 3, row: 4 }), node('s', 'b', [], 'known')], bands);
    expect(find(t, 'x').y).toBe(find(t, 'r').y);
    expect(find(t, 'y').x).toBe(PAD_X + 3 * COL);
    expect(find(t, 'y').row).toBe(4);
    expect(t.bands[1]?.top).toBeGreaterThan(t.bands[0]?.top ?? 0);
  });

  it('puts a node with a cross-band prerequisite one column further right', () => {
    const t = layoutResearch([node('r', 'a', [], 'known'), node('s', 'b', [], 'known'), node('c', 'b', ['s', 'r'])], bands);
    expect(find(t, 'c').col).toBe(2);
  });
});

describe('research layout: links', () => {
  it('chain: an elbow with the vertical 30 px right of the parent', () => {
    const t = layoutResearch([node('r', 'a', [], 'known'), node('m2', 'a', ['r'], 'known')], bands);
    const p = find(t, 'r');
    expect(link(t, 'r', 'm2').points).toEqual([[p.x + NODE_W, p.y + 20], [p.x + NODE_W + TRUNK_GUTTER, p.y + 20], [p.x + NODE_W + TRUNK_GUTTER, p.y + 20], [p.x + COL, p.y + 20]]);
  });

  it('fan-out: the children of one parent share one trunk', () => {
    const t = layoutResearch([node('f', 'a', [], 'known'), ...['a1', 'a2', 'a3'].map((id) => node(id, 'a', ['f']))], bands);
    const trunks = ['a1', 'a2', 'a3'].map((id) => link(t, 'f', id).points[1]?.[0]);
    expect(new Set(trunks).size).toBe(1);
    expect(trunks[0]).toBe(PAD_X + NODE_W + TRUNK_GUTTER);
    expect(new Set(['a1', 'a2', 'a3'].map((id) => link(t, 'f', id).points.at(-1)?.[1])).size).toBe(3);
  });

  it('fan-in: every parent link ends on the same point of the child left edge', () => {
    const t = layoutResearch([node('p', 'a', [], 'known'), node('q', 'a', [], 'known'), node('k', 'a', ['p', 'q'])], bands);
    const c = find(t, 'k');
    const ends = ['p', 'q'].map((id) => link(t, id, 'k').points.at(-1));
    expect(ends[0]).toEqual([c.x, c.y + NODE_H / 2]);
    expect(ends[1]).toEqual(ends[0]);
  });

  it('cross-band: the vertical runs in the gutter left of the child', () => {
    const t = layoutResearch([node('r', 'a', [], 'known'), node('s', 'b', [], 'known'), node('c', 'b', ['s', 'r'])], bands);
    const l = link(t, 'r', 'c');
    expect(l.cross).toBe(true);
    expect(l.points.some(([x]) => x === find(t, 'c').x - CHILD_GUTTER)).toBe(true);
    expect(link(t, 's', 'c').cross).toBe(false);
  });

  it('skip-column: the long horizontal never runs through the nodes between', () => {
    const nodes = [
      node('r', 'a', [], 'known'), node('m2', 'a', ['r'], 'known'), node('m3', 'a', ['m2'], 'known'), node('m4', 'a', ['m3']),
      node('far', 'a', ['r'], 'open', { col: 3, row: 0 }),
      node('lo', 'a', ['m2'], 'open', { col: 3, row: 2 }),
    ];
    const t = layoutResearch(nodes, bands);
    for (const [from, to] of [['r', 'far'], ['m2', 'lo']] as const) {
      const l = link(t, from, to);
      expect(l.points.length).toBeGreaterThan(4);
      for (const n of t.nodes) if (n.node.id !== from && n.node.id !== to) expect(hits(l.points, n), `${from}->${to} through ${n.node.id}`).toBe(false);
      expect(l.points.at(-1)).toEqual([find(t, to).x, find(t, to).y + 20]);
    }
    // The lane sits in the gap between two rows.
    const lane = link(t, 'r', 'far').points[2]?.[1] as number;
    expect((lane - find(t, 'r').y) % ROW).toBe(NODE_H + (ROW - NODE_H) / 2);
  });

  it('styles each link on its own from its two ends', () => {
    const t = layoutResearch([
      node('p', 'a', [], 'known'), node('q', 'a', [], 'known'), node('k', 'a', ['p', 'q'], 'known'),
      node('o', 'a', ['k'], 'open'), node('l', 'a', ['k', 'o'], 'locked'),
    ], bands);
    expect(link(t, 'p', 'k').tone).toBe('known');
    expect(link(t, 'k', 'o').tone).toBe('open');
    expect(link(t, 'k', 'l').tone).toBe('locked');
    expect(link(t, 'o', 'l').tone).toBe('locked');
  });
});
