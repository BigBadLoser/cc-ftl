import type { UiResearchNode } from './api';

/**
 * Research tree layout: pure geometry, no DOM. It takes the nodes (with their state already resolved by app/researchSnapshot) and the bands
 * and returns where every node goes and the path of every link. The components only draw what it returns.
 *
 * Placement: a band per category; a node's column is one right of its furthest prerequisite (two right when that prerequisite sits in another
 * band, so the link has a clear lane); its row follows the tree (the first child sits on its parent's row, siblings stack below). `col` / `row`
 * on a node override both.
 *
 * Links are polylines, always orthogonal. Prerequisites are AND: a node has one link per parent.
 *  - chain / fan-out: parent right edge, horizontal to a trunk 30 px right of the parent, vertical, horizontal into the child. Children of one
 *    parent share the trunk.
 *  - fan-in: each parent's link ends at the child's left edge, on the same point, with no marker.
 *  - cross-band and skip-column (a parent more than one column left): the vertical runs in the gutter 22 px left of the child, and the long
 *    horizontal runs in the gap between two rows, where no node ever stands.
 */
export const NODE_W = 170;
export const NODE_H = 40;
export const COL = 230;
export const ROW = 50;
export const PAD_X = 20;
export const PAD_TOP = 36;
export const PAD_BOTTOM = 10;
export const BAND_GAP = 12;
export const TRUNK_GUTTER = 30;
export const CHILD_GUTTER = 22;

export type Point = [number, number];
export interface PlacedNode { node: UiResearchNode; x: number; y: number; col: number; row: number }
export interface BandBox { id: string; name: string; top: number; height: number; width: number }
export interface Link {
  from: string;
  to: string;
  /** The parent is in another band (drawn on the overlay). */
  cross: boolean;
  points: Point[];
  d: string;
  /** Styled from the two ends on their own: known to known green, into a researchable node amber, into a locked one grey dashed. */
  tone: 'known' | 'open' | 'locked';
}
export interface ResearchLayout { bands: BandBox[]; nodes: PlacedNode[]; links: Link[]; width: number; height: number }

const pathOf = (pts: Point[]): string => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

/** The link from `p` to `c`; `lane` (a y in a row gap) is used when the straight elbow would cross nodes. */
function route(p: PlacedNode, c: PlacedNode, simple: boolean): Point[] {
  const x1 = p.x + NODE_W, y1 = p.y + NODE_H / 2, x2 = c.x, y2 = c.y + NODE_H / 2;
  if (simple) {
    const mx = x1 + TRUNK_GUTTER;
    return [[x1, y1], [mx, y1], [mx, y2], [x2, y2]];
  }
  const mx = x1 + TRUNK_GUTTER, gx = x2 - CHILD_GUTTER;
  const lane = y2 >= y1 ? p.y + NODE_H + (ROW - NODE_H) / 2 : p.y - (ROW - NODE_H) / 2;
  return [[x1, y1], [mx, y1], [mx, lane], [gx, lane], [gx, y2], [x2, y2]];
}

export function layoutResearch(nodes: readonly UiResearchNode[], bands: readonly { id: string; name: string }[]): ResearchLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const colMemo = new Map<string, number>();
  const colOf = (n: UiResearchNode, seen = new Set<string>()): number => {
    const memo = colMemo.get(n.id);
    if (memo !== undefined) return memo;
    if (seen.has(n.id)) return 0;
    seen.add(n.id);
    let col = 0;
    for (const id of n.parents) {
      const p = byId.get(id);
      if (p) col = Math.max(col, colOf(p, seen) + (p.band === n.band ? 1 : 2));
    }
    const out = n.col ?? col;
    colMemo.set(n.id, out);
    return out;
  };
  const cell = new Map<string, { col: number; row: number }>();
  const out: ResearchLayout = { bands: [], nodes: [], links: [], width: 0, height: 0 };
  let top = 0;
  for (const band of bands) {
    const mine = nodes.filter((n) => n.band === band.id);
    if (mine.length === 0) continue;
    const inBand = (id: string): boolean => byId.get(id)?.band === band.id;
    const kids = new Map<string, UiResearchNode[]>();
    const roots: UiResearchNode[] = [];
    for (const n of mine) {
      const primary = n.parents.find(inBand);
      if (primary) kids.set(primary, [...(kids.get(primary) ?? []), n]);
      else roots.push(n);
    }
    let rows = 0;
    const place = (n: UiResearchNode): number => {
      const first = (kids.get(n.id) ?? []).map(place)[0];
      const row = n.row ?? first ?? rows++;
      rows = Math.max(rows, row + 1);
      cell.set(n.id, { col: colOf(n), row });
      return row;
    };
    roots.forEach(place);
    const height = PAD_TOP + Math.max(1, rows) * ROW + PAD_BOTTOM;
    const cols = Math.max(...mine.map((n) => cell.get(n.id)?.col ?? 0)) + 1;
    out.bands.push({ id: band.id, name: band.name, top, height, width: PAD_X * 2 + (cols - 1) * COL + NODE_W });
    for (const n of mine) {
      const c = cell.get(n.id) as { col: number; row: number };
      out.nodes.push({ node: n, col: c.col, row: c.row, x: PAD_X + c.col * COL, y: top + PAD_TOP + c.row * ROW });
    }
    top += height + BAND_GAP;
  }
  const at = new Map(out.nodes.map((p) => [p.node.id, p]));
  for (const c of out.nodes) {
    for (const id of c.node.parents) {
      const p = at.get(id);
      if (!p) continue;
      const cross = p.node.band !== c.node.band;
      const points = route(p, c, !cross && c.col - p.col === 1);
      const tone = c.node.status === 'locked' ? 'locked' : p.node.status === 'known' && c.node.status === 'known' ? 'known' : 'open';
      out.links.push({ from: id, to: c.node.id, cross, points, d: pathOf(points), tone });
    }
  }
  out.width = Math.max(0, ...out.bands.map((b) => b.width));
  out.height = Math.max(0, top - BAND_GAP);
  return out;
}
