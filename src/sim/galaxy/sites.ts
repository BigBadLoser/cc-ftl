import { dist, type Vec } from './geometry';
import { coreness, density, keepChance, lerp } from './density';
import { unit } from './hash';
import {
  HULL_GAP, RELAX_RANGE, RELAX_STEP, SECTOR_RADIUS_CORE, SECTOR_RADIUS_FRINGE, SECTOR_RADIUS_MAX, SITE_CELL, SITE_MAX_SHIFT,
  SITE_MIN_DIST, SITE_SPACING_FRINGE,
} from './tuning';

/** A sector site: its global cell, final position and radius. */
export interface Site {
  gx: number;
  gy: number;
  id: string;
  x: number;
  y: number;
  r: number;
  /** Coreness of the density field here, in [0, 1]: 1 in dense cores, 0 at the fringe of a void. */
  core: number;
}

interface Candidate {
  x: number;
  y: number;
  pri: number;
}

const OFFSET = 1 << 15;
const cellKey = (gx: number, gy: number): number => (gx + OFFSET) * 65536 + (gy + OFFSET);
/** The cell a coordinate falls in. Cells are centred: cell 0 spans [-CELL/2, CELL/2), so the start sits in its middle. */
export const cellOf = (v: number): number => Math.floor(v / SITE_CELL + 0.5);
export const sectorId = (gx: number, gy: number): string => `s.${gx}.${gy}`;

/**
 * Endless blue-noise sector sites, computed per global cell from the seed alone (no chunk ever looks at generation
 * order), in four memoised stages:
 * 1. **Candidate:** one jittered point and a random priority per cell. The start cell's candidate is pinned at (0, 0)
 *    with the top priority.
 * 2. **Thinning (Matérn II):** a candidate survives unless a higher-priority candidate lies within the larger of the
 *    two candidates' spacings (SITE_MIN_DIST at the core, SITE_SPACING_FRINGE at the fringe). The
 *    test reads only candidates, never other survivors, so it is local and order-free.
 * 3. **Relaxation:** survivors push apart from survivors within RELAX_RANGE (one step, at most SITE_MAX_SHIFT). The moved
 *    point is kept only if it is still SITE_MIN_DIST from every neighbour's raw *and* moved point, so the minimum
 *    distance holds whichever of the two each neighbour keeps.
 * 4. **Radius:** a random radius capped at (nearest site - HULL_GAP) / 2, so neighbouring hulls never overlap.
 * Every stage looks a bounded distance around the cell, so neighbouring chunks agree at the seams by construction.
 */
export class SiteField {
  private cand = new Map<number, Candidate>();
  private kept = new Map<number, boolean>();
  private moved = new Map<number, Vec>();
  private fin = new Map<number, Vec>();
  private sites = new Map<number, Site | null>();
  private cores = new Map<number, number>();

  constructor(readonly seed: number) {}

  candidate(gx: number, gy: number): Candidate {
    const k = cellKey(gx, gy);
    let c = this.cand.get(k);
    if (!c) {
      c = gx === 0 && gy === 0
        ? { x: 0, y: 0, pri: 2 }
        : {
          x: (gx - 0.5 + unit(this.seed, gx, gy, 1)) * SITE_CELL,
          y: (gy - 0.5 + unit(this.seed, gx, gy, 2)) * SITE_CELL,
          pri: unit(this.seed, gx, gy, 3),
        };
      this.cand.set(k, c);
    }
    return c;
  }

  /** Coreness of the density field at the cell's candidate. */
  core(gx: number, gy: number): number {
    const k = cellKey(gx, gy);
    let v = this.cores.get(k);
    if (v === undefined) {
      const c = this.candidate(gx, gy);
      v = coreness(density(this.seed, c.x, c.y));
      this.cores.set(k, v);
    }
    return v;
  }

  /** The room a candidate needs: SITE_MIN_DIST at the core, up to SITE_SPACING_FRINGE at the fringe. */
  private spacing(gx: number, gy: number): number {
    return lerp(SITE_SPACING_FRINGE, SITE_MIN_DIST, this.core(gx, gy));
  }

  /** Stage 1b: did the cell's candidate survive density thinning? Only present candidates compete in stage 2. */
  private present(gx: number, gy: number): boolean {
    if (gx === 0 && gy === 0) return true;
    return unit(this.seed, gx, gy, 5) < keepChance(this.core(gx, gy));
  }

  /** Stage 2: does the cell hold a site? */
  accepted(gx: number, gy: number): boolean {
    const k = cellKey(gx, gy);
    let v = this.kept.get(k);
    if (v === undefined) {
      const c = this.candidate(gx, gy);
      v = this.present(gx, gy);
      const reach = Math.ceil(SITE_SPACING_FRINGE / SITE_CELL) + 1;
      for (let dy = -reach; dy <= reach && v; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (!this.present(gx + dx, gy + dy)) continue;
          const o = this.candidate(gx + dx, gy + dy);
          // Symmetric: the pair needs the larger of the two spacings, so either cell reaches the same answer.
          if (dist(c, o) >= Math.max(this.spacing(gx, gy), this.spacing(gx + dx, gy + dy))) continue;
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

  /** Accepted cells whose raw candidate lies within `range` of (x, y), in ascending (gy, gx) order. */
  private keptNear(x: number, y: number, range: number): { gx: number; gy: number }[] {
    const out: { gx: number; gy: number }[] = [];
    const reach = range + SITE_CELL;
    for (let gy = cellOf(y - reach); gy <= cellOf(y + reach); gy++) {
      for (let gx = cellOf(x - reach); gx <= cellOf(x + reach); gx++) {
        if (!this.accepted(gx, gy)) continue;
        const c = this.candidate(gx, gy);
        if (Math.hypot(c.x - x, c.y - y) <= range) out.push({ gx, gy });
      }
    }
    return out;
  }

  /** Stage 3a: the relaxed point (before the safety check). Only defined for accepted cells. */
  private relaxed(gx: number, gy: number): Vec {
    const k = cellKey(gx, gy);
    let v = this.moved.get(k);
    if (!v) {
      const p = this.candidate(gx, gy);
      if (gx === 0 && gy === 0) v = { x: p.x, y: p.y };
      else {
        let fx = 0;
        let fy = 0;
        for (const n of this.keptNear(p.x, p.y, RELAX_RANGE)) {
          if (n.gx === gx && n.gy === gy) continue;
          const q = this.candidate(n.gx, n.gy);
          const d = Math.max(1e-6, dist(p, q));
          const w = (RELAX_RANGE - d) / RELAX_RANGE;
          fx += (w * (p.x - q.x)) / d;
          fy += (w * (p.y - q.y)) / d;
        }
        let sx = fx * RELAX_STEP * SITE_MIN_DIST;
        let sy = fy * RELAX_STEP * SITE_MIN_DIST;
        const len = Math.hypot(sx, sy);
        if (len > SITE_MAX_SHIFT) {
          sx *= SITE_MAX_SHIFT / len;
          sy *= SITE_MAX_SHIFT / len;
        }
        v = { x: p.x + sx, y: p.y + sy };
      }
      this.moved.set(k, v);
    }
    return v;
  }

  /** Stage 3b: the final point: relaxed if that keeps the minimum distance to every neighbour's raw and relaxed point. */
  position(gx: number, gy: number): Vec {
    const k = cellKey(gx, gy);
    let v = this.fin.get(k);
    if (!v) {
      const raw = this.candidate(gx, gy);
      const moved = this.relaxed(gx, gy);
      let safe = true;
      for (const n of this.keptNear(raw.x, raw.y, SITE_MIN_DIST + 2 * SITE_MAX_SHIFT)) {
        if (n.gx === gx && n.gy === gy) continue;
        if (dist(moved, this.candidate(n.gx, n.gy)) < SITE_MIN_DIST || dist(moved, this.relaxed(n.gx, n.gy)) < SITE_MIN_DIST) {
          safe = false;
          break;
        }
      }
      v = safe ? moved : { x: raw.x, y: raw.y };
      this.fin.set(k, v);
    }
    return v;
  }

  /** The site of a cell, or null when its candidate was thinned out. */
  site(gx: number, gy: number): Site | null {
    const k = cellKey(gx, gy);
    let s = this.sites.get(k);
    if (s === undefined) {
      if (!this.accepted(gx, gy)) s = null;
      else {
        const p = this.position(gx, gy);
        const raw = this.candidate(gx, gy);
        let nn = Infinity;
        for (const n of this.keptNear(raw.x, raw.y, 2 * SECTOR_RADIUS_MAX + HULL_GAP + 2 * SITE_MAX_SHIFT)) {
          if (n.gx === gx && n.gy === gy) continue;
          nn = Math.min(nn, dist(p, this.position(n.gx, n.gy)));
        }
        const core = this.core(gx, gy);
        const lo = lerp(SECTOR_RADIUS_FRINGE.min, SECTOR_RADIUS_CORE.min, core);
        const hi = lerp(SECTOR_RADIUS_FRINGE.max, SECTOR_RADIUS_CORE.max, core);
        const want = lo + unit(this.seed, gx, gy, 4) * (hi - lo);
        s = { gx, gy, id: sectorId(gx, gy), x: p.x, y: p.y, r: Math.min(want, (nn - HULL_GAP) / 2), core };
      }
      this.sites.set(k, s);
    }
    return s;
  }

  /** Sites whose final position lies within `range` of (x, y), in ascending (gy, gx) order. */
  sitesNear(x: number, y: number, range: number): Site[] {
    const out: Site[] = [];
    for (const n of this.keptNear(x, y, range + SITE_MAX_SHIFT)) {
      const s = this.site(n.gx, n.gy);
      if (s && Math.hypot(s.x - x, s.y - y) <= range) out.push(s);
    }
    return out;
  }
}

/** A stable integer for an id string pair order (used by symmetric pair hashes). */
export const pairHash = (seed: number, a: number, b: number, salt: number): number =>
  unit(seed, Math.min(a, b), Math.max(a, b), salt);

