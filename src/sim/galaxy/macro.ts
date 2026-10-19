import { isGabriel, isRelativeNeighbour, type Vec } from './geometry';
import { unit } from './hash';
import type { TerritoryField } from './territory';
import {
  CLAIM_DENSITY, CLUSTER_CHANCE, CLUSTER_RADIUS, CLUSTER_STRETCH, CLUSTER_WOBBLE, CORRIDOR_DENSITY, CORRIDOR_STEP, CORRIDOR_WIDTH,
  LINK_EXTRA, LINK_MAX, MACRO_CELL, SECOND_CORRIDOR,
} from './tuning';

/**
 * A cluster: a blob of dense space that holds many sectors. Its shape is an ellipse (stretch, angle) with a wobbling rim
 * (lobes, phase, wobble); density is `peak` in the core and fades to zero just past the rim.
 */
export interface Cluster {
  id: string;
  mx: number;
  my: number;
  x: number;
  y: number;
  r: number;
  stretch: number;
  angle: number;
  lobes: number;
  phase: number;
  wobble: number;
  peak: number;
  faction: string | null;
}

/**
 * A corridor: a thin band of density across the void between two linked clusters, where a chain of sectors grows. It
 * runs centre to centre, bent at a midpoint pushed sideways (m), so a pair's two corridors are distinct routes.
 */
export interface Corridor {
  id: string;
  a: Cluster;
  b: Cluster;
  ax: number;
  ay: number;
  mx: number;
  my: number;
  bx: number;
  by: number;
}

const smooth = (e0: number, e1: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** The farthest any cluster's density reaches from its centre. */
export const CLUSTER_REACH = CLUSTER_RADIUS.max * CLUSTER_STRETCH.max * (1 + CLUSTER_WOBBLE) * 1.1;
/** Cluster centres sit within this share of a macro cell from its middle. */
const JITTER = 0.3;
/** Macro cells to look at around a point for clusters (density) and for link candidates and corridors. */
const CLUSTER_RING = Math.ceil(CLUSTER_REACH / MACRO_CELL + 0.5 + JITTER);
const LINK_RING = Math.ceil(LINK_MAX / MACRO_CELL + 2 * JITTER);

const macroOf = (v: number): number => Math.floor(v / MACRO_CELL + 0.5);

/**
 * The galaxy's large-scale shape, decided before any sector is placed: clusters on a coarse jittered grid (some cells
 * empty), joined by corridors along the relative neighbourhood graph of their centres (plus some Gabriel extras), and
 * a density field over the plane. Sector sites grow only where density allows; everything else is void. Every value is
 * a pure function of (seed, macro cell) and reads a bounded ring of cells, so chunks agree at the seams.
 */
export class MacroField {
  private clusters = new Map<string, Cluster | null>();
  private links = new Map<string, Corridor[]>();
  private cellCorridors = new Map<string, Corridor[]>();

  constructor(
    readonly seed: number,
    private readonly territory: TerritoryField,
  ) {}

  /** The cluster grown from a macro cell, or null for an empty cell. Cell (0, 0) always holds one centred on the start. */
  cluster(mx: number, my: number): Cluster | null {
    const key = `${mx},${my}`;
    let c = this.clusters.get(key);
    if (c === undefined) {
      const home = mx === 0 && my === 0;
      const u = (salt: number) => unit(this.seed, mx, my, salt);
      if (!home && u(60) >= CLUSTER_CHANCE) c = null;
      else {
        const x = home ? 0 : (mx + (u(61) * 2 - 1) * JITTER) * MACRO_CELL;
        const y = home ? 0 : (my + (u(62) * 2 - 1) * JITTER) * MACRO_CELL;
        // Skewed sizes: many small clusters, a few large ones.
        const size = home ? 0.4 : u(63) ** 1.4;
        c = {
          id: `c.${mx}.${my}`, mx, my, x, y,
          r: CLUSTER_RADIUS.min + size * (CLUSTER_RADIUS.max - CLUSTER_RADIUS.min),
          stretch: CLUSTER_STRETCH.min + u(64) * (CLUSTER_STRETCH.max - CLUSTER_STRETCH.min),
          angle: u(65) * Math.PI,
          lobes: 2 + Math.floor(u(66) * 3),
          phase: u(67) * Math.PI * 2,
          wobble: u(68) * CLUSTER_WOBBLE,
          peak: 0.7 + 0.3 * u(69),
          faction: this.territory.factionAt(x, y),
        };
      }
      this.clusters.set(key, c);
    }
    return c;
  }

  /** Clusters whose centre lies in the macro cells within `ring` of (mx, my), in ascending (my, mx) order. */
  private ring(mx: number, my: number, ring: number): Cluster[] {
    const out: Cluster[] = [];
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        const c = this.cluster(mx + dx, my + dy);
        if (c) out.push(c);
      }
    }
    return out;
  }

  /** One cluster's density at (x, y). */
  clusterDensity(c: Cluster, x: number, y: number): number {
    const dx = x - c.x;
    const dy = y - c.y;
    const cos = Math.cos(c.angle);
    const sin = Math.sin(c.angle);
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    const rim = c.r * (1 + c.wobble * Math.sin(c.lobes * Math.atan2(v, u) + c.phase));
    const q = Math.hypot(u / c.stretch, v * c.stretch) / rim;
    return c.peak * (1 - smooth(0.5, 1.1, q));
  }

  /**
   * Corridors of a cluster: one per linked neighbour, a second with SECOND_CORRIDOR chance (offset sideways so the two
   * meet the rims at different points). A pair is linked when it is a relative neighbourhood edge of the cluster
   * centres, or with LINK_EXTRA chance a Gabriel edge. Both tests read only clusters within |ab| of each end.
   */
  corridors(c: Cluster): Corridor[] {
    let out = this.links.get(c.id);
    if (!out) {
      out = [];
      const near = this.ring(c.mx, c.my, LINK_RING);
      for (const o of near) {
        if (o === c || Math.hypot(o.x - c.x, o.y - c.y) > LINK_MAX) continue;
        const [a, b] = c.id < o.id ? [c, o] : [o, c];
        const pair = (salt: number) => unit(this.seed, a.mx, a.my, b.mx, b.my, salt);
        const pts: Vec[] = near;
        if (!isRelativeNeighbour(a, b, pts) && !(isGabriel(a, b, pts) && pair(70) < LINK_EXTRA)) continue;
        const count = pair(71) < SECOND_CORRIDOR ? 2 : 1;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / len;
        const ny = (b.x - a.x) / len;
        for (let k = 0; k < count; k++) {
          const side = (count === 1 ? (pair(72) - 0.5) * 0.3 : (k === 0 ? -1 : 1) * (0.18 + 0.1 * pair(73 + k))) * len;
          const mx = (a.x + b.x) / 2 + nx * side;
          const my = (a.y + b.y) / 2 + ny * side;
          out.push({ id: `k:${a.id}|${b.id}|${k}`, a, b, ax: a.x, ay: a.y, mx, my, bx: b.x, by: b.y });
        }
      }
      this.links.set(c.id, out);
    }
    return out;
  }

  /** Corridors passing near a macro cell (within CORRIDOR_WIDTH of it), deduplicated, in id order. */
  private corridorsAt(mx: number, my: number): Corridor[] {
    const key = `${mx},${my}`;
    let out = this.cellCorridors.get(key);
    if (!out) {
      const seen = new Map<string, Corridor>();
      const cx = mx * MACRO_CELL;
      const cy = my * MACRO_CELL;
      const reach = CORRIDOR_WIDTH + MACRO_CELL * Math.SQRT1_2;
      for (const c of this.ring(mx, my, LINK_RING)) {
        for (const k of this.corridors(c)) if (!seen.has(k.id) && segDist(k, cx, cy).d <= reach) seen.set(k.id, k);
      }
      out = [...seen.values()].sort((p, q) => (p.id < q.id ? -1 : 1));
      this.cellCorridors.set(key, out);
    }
    return out;
  }

  /** The strongest cluster at (x, y) and its density there (null when no cluster reaches it). */
  dominant(x: number, y: number): { cluster: Cluster | null; d: number } {
    let best: Cluster | null = null;
    let d = 0;
    for (const c of this.ring(macroOf(x), macroOf(y), CLUSTER_RING)) {
      const v = this.clusterDensity(c, x, y);
      if (v > d) {
        d = v;
        best = c;
      }
    }
    return { cluster: best, d };
  }

  /** The nearest corridor axis to (x, y) and the corridor density there. */
  corridorAt(x: number, y: number): { corridor: Corridor | null; d: number; near: Near } {
    let best: Corridor | null = null;
    let near: Near = { d: Infinity, px: x, py: y, dx: 1, dy: 0, s: 0 };
    for (const k of this.corridorsAt(macroOf(x), macroOf(y))) {
      const s = segDist(k, x, y);
      if (s.d < near.d) {
        near = s;
        best = k;
      }
    }
    const d = best ? CORRIDOR_DENSITY * (1 - smooth(0.4 * CORRIDOR_WIDTH, CORRIDOR_WIDTH, near.d)) : 0;
    return { corridor: best, d, near };
  }

  /** Density at (x, y): the stronger of the dominant cluster and the nearest corridor. 0 is void. */
  density(x: number, y: number): number {
    return Math.max(this.dominant(x, y).d, this.corridorAt(x, y).d);
  }

  /** The cluster a point belongs to (its dominant cluster, when that is dense enough to claim it). */
  clusterAt(x: number, y: number): Cluster | null {
    const m = this.dominant(x, y);
    return m.d >= CLAIM_DENSITY ? m.cluster : null;
  }

  /**
   * Territory at a point: the faction of its cluster. Corridor space between two clusters of the same faction is
   * theirs; between rivals (or out in the fringe) it is open space.
   */
  factionAt(x: number, y: number): string | null {
    const c = this.clusterAt(x, y);
    if (c) return c.faction;
    const k = this.corridorAt(x, y);
    return k.corridor && k.d >= CLAIM_DENSITY && k.corridor.a.faction === k.corridor.b.faction ? k.corridor.a.faction : null;
  }

  /** Clusters with a centre within `range` of (x, y) (for tools and metrics). */
  clustersNear(x: number, y: number, range: number): Cluster[] {
    const ring = Math.ceil(range / MACRO_CELL + 0.5 + JITTER);
    return this.ring(macroOf(x), macroOf(y), ring).filter((c) => Math.hypot(c.x - x, c.y - y) <= range);
  }
}

/** Distance from (x, y) to a segment, the closest point on it and the segment's direction. */
function seg(ax: number, ay: number, bx: number, by: number, x: number, y: number): Near {
  const vx = bx - ax;
  const vy = by - ay;
  const len = Math.hypot(vx, vy) || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (len * len)));
  const px = ax + t * vx;
  const py = ay + t * vy;
  return { d: Math.hypot(x - px, y - py), px, py, dx: vx / len, dy: vy / len, s: t * len };
}

/** Closest point on a corridor axis: distance to it, the point, the leg's direction and the arc length from end a. */
export interface Near {
  d: number;
  px: number;
  py: number;
  dx: number;
  dy: number;
  s: number;
}

/** Distance from (x, y) to a corridor's bent axis (its two legs), the closest point and the leg's direction. */
export function segDist(k: Corridor, x: number, y: number): Near {
  const p = seg(k.ax, k.ay, k.mx, k.my, x, y);
  const q = seg(k.mx, k.my, k.bx, k.by, x, y);
  if (p.d <= q.d) return p;
  q.s += Math.hypot(k.mx - k.ax, k.my - k.ay);
  return q;
}

/**
 * The corridor station nearest arc length `s`: stations sit every CORRIDOR_STEP along the axis, so candidates snapped to
 * them leave exactly one site per station after thinning (no Matérn gaps along the chain).
 */
export function station(k: Corridor, s: number): Near {
  const l1 = Math.hypot(k.mx - k.ax, k.my - k.ay);
  const l2 = Math.hypot(k.bx - k.mx, k.by - k.my);
  const n = Math.max(1, Math.round((l1 + l2) / CORRIDOR_STEP));
  const step = (l1 + l2) / n;
  const at = Math.max(1, Math.min(n - 1, Math.round(s / step))) * step;
  return at <= l1 ? seg(k.ax, k.ay, k.mx, k.my, k.ax + ((k.mx - k.ax) * at) / (l1 || 1), k.ay + ((k.my - k.ay) * at) / (l1 || 1))
    : seg(k.mx, k.my, k.bx, k.by, k.mx + ((k.bx - k.mx) * (at - l1)) / (l2 || 1), k.my + ((k.by - k.my) * (at - l1)) / (l2 || 1));
}
