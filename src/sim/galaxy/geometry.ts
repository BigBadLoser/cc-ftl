/** Plane geometry for the starmap: hulls, overlap tests, proximity graphs and spanning trees. */

export interface Vec {
  x: number;
  y: number;
}

export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a: Vec, b: Vec): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Convex hull (Andrew's monotone chain), counter-clockwise, no collinear points. Fewer than 3 points come back as given. */
export function convexHull(points: readonly Vec[]): Vec[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Vec, a: Vec, b: Vec) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2] as Vec, lower[lower.length - 1] as Vec, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i] as Vec;
    while (upper.length >= 2 && cross(upper[upper.length - 2] as Vec, upper[upper.length - 1] as Vec, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** The convex hull of discs of radius `pad` around the points (each disc as an octagon): a rounded, padded hull. */
export function paddedHull(points: readonly Vec[], pad: number): Vec[] {
  const ring: Vec[] = [];
  for (const p of points) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      ring.push({ x: p.x + pad * Math.cos(a), y: p.y + pad * Math.sin(a) });
    }
  }
  return convexHull(ring);
}

/** True when two convex polygons overlap (separating axis test; touching edges count as apart). */
export function convexOverlap(a: readonly Vec[], b: readonly Vec[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i] as Vec;
      const q = poly[(i + 1) % poly.length] as Vec;
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const v of a) {
        const d = v.x * nx + v.y * ny;
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      for (const v of b) {
        const d = v.x * nx + v.y * ny;
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      if (maxA <= minB || maxB <= minA) return false;
    }
  }
  return true;
}

/**
 * Gabriel test: no other point lies strictly inside the circle on segment ab as diameter. Gabriel edges are a planar
 * subset of the Delaunay triangulation without its long sliver edges, and they contain the minimum spanning tree.
 */
export function isGabriel(a: Vec, b: Vec, others: readonly Vec[]): boolean {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const r2 = dist2(a, b) / 4;
  return others.every((c) => c === a || c === b || dist2(mid, c) >= r2 - 1e-9);
}

/**
 * Relative neighbourhood test: no other point is closer to both a and b than they are to each other. RNG edges contain
 * the minimum spanning tree (so they connect the points), and the test needs only points within |ab| of a: it is local.
 */
export function isRelativeNeighbour(a: Vec, b: Vec, others: readonly Vec[]): boolean {
  const d2 = dist2(a, b);
  return others.every((c) => c === a || c === b || Math.max(dist2(a, c), dist2(b, c)) >= d2 - 1e-9);
}

/** Gabriel edges [i, j] (i < j) of a small point set, in ascending (i, j) order. O(n^3): for sectors of a few dozen nodes. */
export function gabrielEdges(points: readonly Vec[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (isGabriel(points[i] as Vec, points[j] as Vec, points)) out.push([i, j]);
    }
  }
  return out;
}

/** Minimum spanning forest (Kruskal) over the given edges; ties by input order. Returns the chosen edges. */
export function spanningTree(points: readonly Vec[], edges: readonly [number, number][]): [number, number][] {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i] as number] as number;
    return i;
  };
  const sorted = edges
    .map((e, k) => ({ e, k, d: dist2(points[e[0]] as Vec, points[e[1]] as Vec) }))
    .sort((p, q) => p.d - q.d || p.k - q.k);
  const out: [number, number][] = [];
  for (const { e } of sorted) {
    const ra = find(e[0]);
    const rb = find(e[1]);
    if (ra === rb) continue;
    parent[ra] = rb;
    out.push(e);
  }
  return out;
}
