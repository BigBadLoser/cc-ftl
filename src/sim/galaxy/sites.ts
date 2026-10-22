import { dist, type Vec } from './geometry';
import { unit } from './hash';
import type { Terrain } from './terrain';
import {
  DENSITY_FULL, DENSITY_MIN, HULL_GAP, SECTOR_RADIUS, SITE_CELL, SITE_SPACING,
} from './tuning';

/** A sector site: its global cell, position, radius and the terrain density it grew in (0 void .. 1 dense core). */
export interface Site {
  gx: number;
  gy: number;
  id: string;
  x: number;
  y: number;
  r: number;
  density: number;
}

interface Candidate {
  x: number;
  y: number;
  pri: number;
  density: number;
  /** Survives the density roll (before thinning). */
  alive: boolean;
  /** Spacing it asks of its neighbours. */
  spacing: number;
}

const OFFSET = 1 << 15;
const cellKey = (gx: number, gy: number): number => (gx + OFFSET) * 65536 + (gy + OFFSET);
/** The cell a coordinate falls in. Cells are centred: cell 0 spans [-CELL/2, CELL/2), so the start sits in its middle. */
export const cellOf = (v: number): number => Math.floor(v / SITE_CELL + 0.5);
const sectorId = (gx: number, gy: number): string => `s.${gx}.${gy}`;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.max(0, Math.min(1, t));
const smooth = (e0: number, e1: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** How far a candidate can sit from its cell centre per axis. */
const DRIFT = SITE_CELL / 2;
/** Cells the widest pair spacing can span. */
const REACH = Math.ceil((SITE_SPACING.void + 2 * DRIFT) / SITE_CELL);
const R_MAX = SECTOR_RADIUS.void * 1.15;

/**
 * Endless sector sites on the terrain, computed per global cell from the seed alone (no chunk ever looks
 * at generation order), in three memoised stages:
 * 1. **Candidate:** one jittered point and a random priority per cell, alive with a chance rising with the terrain
 *    density there (void: none).
 *    The start cell's candidate is pinned at (0, 0), alive, with the top priority.
 * 2. **Thinning (Matérn II):** a live candidate survives unless a higher-priority live candidate lies within their
 *    pair spacing (dense cores pack tighter). The test reads only candidates, never survivors: local and order-free.
 * 3. **Radius:** by density (small in cores, large in the fringe), capped at (nearest site - HULL_GAP) / 2, so
 *    neighbouring hulls never overlap.
 * Every stage looks a bounded distance around the cell, so neighbouring chunks agree at the seams by construction.
 */
export class SiteField {
  private cand = new Map<number, Candidate>();
  private kept = new Map<number, boolean>();
  private sites = new Map<number, Site | null>();

  constructor(
    readonly seed: number,
    readonly terrain: Terrain,
  ) {}

  candidate(gx: number, gy: number): Candidate {
    const k = cellKey(gx, gy);
    let c = this.cand.get(k);
    if (!c) {
      const u = (salt: number) => unit(this.seed, gx, gy, salt);
      if (gx === 0 && gy === 0) c = { x: 0, y: 0, pri: 2, density: 1, alive: true, spacing: SITE_SPACING.core };
      else {
        const x = (gx - 0.5 + u(1)) * SITE_CELL;
        const y = (gy - 0.5 + u(2)) * SITE_CELL;
        const density = this.terrain.density(x, y);
        const alive = density >= DENSITY_MIN && u(4) < smooth(DENSITY_MIN, DENSITY_FULL, density);
        c = { x, y, pri: u(3), density, alive, spacing: lerp(SITE_SPACING.void, SITE_SPACING.core, density) };
      }
      this.cand.set(k, c);
    }
    return c;
  }

  /** Stage 2: does the cell hold a site? */
  accepted(gx: number, gy: number): boolean {
    const k = cellKey(gx, gy);
    let v = this.kept.get(k);
    if (v === undefined) {
      const c = this.candidate(gx, gy);
      v = c.alive;
      for (let dy = -REACH; dy <= REACH && v; dy++) {
        for (let dx = -REACH; dx <= REACH; dx++) {
          if (dx === 0 && dy === 0) continue;
          const o = this.candidate(gx + dx, gy + dy);
          if (!o.alive || dist(c, o) >= (c.spacing + o.spacing) / 2) continue;
          if (o.pri > c.pri || (o.pri === c.pri && cellKey(gx + dx, gy + dy) > k)) {
            v = false;
            break;
          }
        }
      }
      this.kept.set(k, v);
    }
    return v;
  }

  /** Accepted cells whose point lies within `range` of (x, y), in ascending (gy, gx) order. */
  private keptNear(x: number, y: number, range: number): { gx: number; gy: number }[] {
    const out: { gx: number; gy: number }[] = [];
    const reach = range + DRIFT;
    for (let gy = cellOf(y - reach); gy <= cellOf(y + reach); gy++) {
      for (let gx = cellOf(x - reach); gx <= cellOf(x + reach); gx++) {
        if (!this.accepted(gx, gy)) continue;
        const c = this.candidate(gx, gy);
        if (Math.hypot(c.x - x, c.y - y) <= range) out.push({ gx, gy });
      }
    }
    return out;
  }

  /** The site of a cell, or null when its candidate died or was thinned out. */
  site(gx: number, gy: number): Site | null {
    const k = cellKey(gx, gy);
    let s = this.sites.get(k);
    if (s === undefined) {
      if (!this.accepted(gx, gy)) s = null;
      else {
        const p: Vec = this.candidate(gx, gy);
        const density = this.candidate(gx, gy).density;
        let nn = Infinity;
        for (const n of this.keptNear(p.x, p.y, 2 * R_MAX + HULL_GAP)) {
          if (n.gx === gx && n.gy === gy) continue;
          nn = Math.min(nn, dist(p, this.candidate(n.gx, n.gy)));
        }
        const want = lerp(SECTOR_RADIUS.void, SECTOR_RADIUS.core, density) * (0.85 + 0.3 * unit(this.seed, gx, gy, 6));
        s = { gx, gy, id: sectorId(gx, gy), x: p.x, y: p.y, r: Math.min(want, (nn - HULL_GAP) / 2), density };
      }
      this.sites.set(k, s);
    }
    return s;
  }

  /** Sites within `range` of (x, y), in ascending (gy, gx) order. */
  sitesNear(x: number, y: number, range: number): Site[] {
    const out: Site[] = [];
    for (const n of this.keptNear(x, y, range)) {
      const s = this.site(n.gx, n.gy);
      if (s) out.push(s);
    }
    return out;
  }
}
