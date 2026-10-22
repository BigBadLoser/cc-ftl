import type { GalaxyContent } from './defs';
import { hash32, unit } from './hash';
import type { Terrain } from './terrain';
import { dangerAt, type TerritoryField } from './territory';
import {
  LANE_MIN_DENSITY, MIN_CLUSTER_SECTORS, CLUSTER_BORDER_WOBBLE, CLUSTER_CELL, CLUSTER_REACH, CLUSTER_RIFT_COST, CLUSTER_SEED_DENSITY, CLUSTER_SPACING, WILD_GAP, WILD_MATES, WILD_VOID,
} from './tuning';

/** A cluster (province): a named group of sectors around a seed, owned by one faction or by nobody. */
export interface Cluster {
  id: string;
  rx: number;
  ry: number;
  x: number;
  y: number;
  name: string;
  faction: string | null;
  /** What to expect there (clusterType): core, border, corporate, trade, pirate, machine, frontier or rich. */
  type: ClusterType;
  /** Its seed's spacing: larger clusters claim further (reach costs are divided by reach / CLUSTER_SPACING mean). */
  reach: number;
}

type ClusterType = 'core' | 'border' | 'corporate' | 'trade' | 'pirate' | 'machine' | 'frontier' | 'rich';

/** Candidates sit anywhere in their cell, so a seed is up to half a cell from its cell centre on each axis. */
const JITTER = 0.5;
const RING = Math.ceil(CLUSTER_REACH / CLUSTER_CELL + 0.5 + JITTER);
/** Cells the widest pair spacing can span (for thinning). */
const THIN = Math.ceil(CLUSTER_SPACING.max / CLUSTER_CELL) + 1;

interface SeedCandidate {
  x: number;
  y: number;
  pri: number;
  spacing: number;
  /** Landed on dense enough ground. */
  ok: boolean;
}
const cellOf = (v: number): number => Math.floor(v / CLUSTER_CELL + 0.5);

/**
 * Clusters over the terrain: seeds thinned to irregular, varied spacing (see cluster()), on dense ground only. A
 * point belongs to the seed it is cheapest to reach, where distance is wobbled by noise and every unit of void on the
 * way costs CLUSTER_RIFT_COST extra, so borders follow the rifts. A seed that would get fewer than MIN_CLUSTER_SECTORS
 * sectors is dropped and its sectors join their next-cheapest cluster. All of it reads a bounded ring of cells: chunk-safe.
 */
export class ClusterField {
  private clusters = new Map<string, Cluster | null>();
  private cands = new Map<string, SeedCandidate>();
  private owner = new Map<string, Cluster | null>();
  private base = new Map<string, Cluster | null>();
  private keep = new Map<string, boolean>();
  private claimed = new Map<string, Cluster | null>();
  private hubs = new Map<string, { x: number; y: number } | null>();

  constructor(
    readonly seed: number,
    private readonly terrain: Terrain,
    private readonly sites: { sitesNear(x: number, y: number, range: number): readonly { x: number; y: number }[] },
    private readonly territory: TerritoryField,
    private readonly content: GalaxyContent | undefined,
  ) {}

  /** A cell's seed candidate: a point on dense ground (a few tries), a priority and a spacing (skewed small). */
  private candidate(rx: number, ry: number): SeedCandidate {
    const key = `${rx},${ry}`;
    let c = this.cands.get(key);
    if (!c) {
      const u = (salt: number) => unit(this.seed, rx, ry, salt);
      const spacing = CLUSTER_SPACING.min + u(85) ** 1.3 * (CLUSTER_SPACING.max - CLUSTER_SPACING.min);
      if (rx === 0 && ry === 0) c = { x: 0, y: 0, pri: 2, spacing, ok: true };
      else {
        c = { x: 0, y: 0, pri: u(86), spacing, ok: false };
        for (let k = 0; k < 3 && !c.ok; k++) {
          c.x = (rx - 0.5 + unit(this.seed, rx, ry, k, 81)) * CLUSTER_CELL;
          c.y = (ry - 0.5 + unit(this.seed, rx, ry, k, 82)) * CLUSTER_CELL;
          c.ok = this.terrain.density(c.x, c.y) >= CLUSTER_SEED_DENSITY;
        }
      }
      this.cands.set(key, c);
    }
    return c;
  }

  /**
   * The cluster seeded in a cell, or null. Candidates are thinned Matérn-style: one survives unless a higher-priority
   * candidate lies within their mean spacing, so seeds fall irregularly (no grid) and clusters vary in size. The start
   * cell's seed sits at the origin with the top priority.
   */
  cluster(rx: number, ry: number): Cluster | null {
    const key = `${rx},${ry}`;
    let r = this.clusters.get(key);
    if (r === undefined) {
      r = null;
      const c = this.candidate(rx, ry);
      let alive = c.ok;
      for (let dy = -THIN; dy <= THIN && alive; dy++) {
        for (let dx = -THIN; dx <= THIN; dx++) {
          if (dx === 0 && dy === 0) continue;
          const o = this.candidate(rx + dx, ry + dy);
          if (!o.ok || Math.hypot(o.x - c.x, o.y - c.y) >= (o.spacing + c.spacing) / 2) continue;
          if (o.pri > c.pri || (o.pri === c.pri && (dy > 0 || (dy === 0 && dx > 0)))) {
            alive = false;
            break;
          }
        }
      }
      if (alive) {
        const faction = this.territory.factionAt(c.x, c.y);
        r = { id: `g.${rx}.${ry}`, rx, ry, x: c.x, y: c.y, name: this.nameOf(rx, ry), faction, type: this.typeOf(faction, c.x, c.y), reach: c.spacing };
      }
      this.clusters.set(key, r);
    }
    return r;
  }

  /**
   * A cluster's type, from its owner's kind, its danger and its terrain: a government's safe space is its core and its
   * dangerous space a border march; unclaimed dense space is rich (and contested), sparse space frontier.
   */
  private typeOf(faction: string | null, x: number, y: number): ClusterType {
    const kind = faction ? this.content?.factions[faction]?.kind : undefined;
    const danger = dangerAt(x, y);
    if (kind === 'government') return danger <= 2 ? 'core' : 'border';
    if (kind === 'corporation') return 'corporate';
    if (kind === 'civilian') return 'trade';
    if (kind === 'pirates') return 'pirate';
    if (kind === 'rogue') return 'machine';
    return this.terrain.density(x, y) > 0.6 ? 'rich' : 'frontier';
  }

  private nameOf(rx: number, ry: number): string {
    const pre = this.content?.names.prefix ?? [];
    const suf = this.content?.names.suffix ?? [];
    if (!pre.length || !suf.length) return `g.${rx}.${ry}`;
    return `${pre[hash32(this.seed, rx, ry, 83) % pre.length]} ${suf[hash32(this.seed, rx, ry, 84) % suf.length]}`;
  }

  /** Clusters whose seed cell lies within `ring` cells of the cell holding (x, y). */
  near(x: number, y: number, ring = RING): Cluster[] {
    const out: Cluster[] = [];
    const cx = cellOf(x);
    const cy = cellOf(y);
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        const r = this.cluster(cx + dx, cy + dy);
        if (r) out.push(r);
      }
    }
    return out;
  }

  /** Cost of reaching (x, y) from a cluster's seed. */
  cost(r: Cluster, x: number, y: number): number {
    const d = Math.hypot(x - r.x, y - r.y);
    if (d > CLUSTER_REACH) return Infinity;
    const wob = 1 + CLUSTER_BORDER_WOBBLE * (this.terrain.wobble(x, y, 1400, hash32(r.rx, r.ry) % 997) - 0.5) * 2;
    const strength = r.reach / ((CLUSTER_SPACING.min + CLUSTER_SPACING.max) / 2);
    return (d * wob) / strength + CLUSTER_RIFT_COST * this.terrain.voidRun(r.x, r.y, x, y, LANE_MIN_DENSITY, 100).total;
  }

  /** The cheapest seed to reach (x, y) among those passing `ok`. */
  private cheapest(x: number, y: number, ok: (r: Cluster) => boolean): Cluster | null {
    let best: Cluster | null = null;
    let score = Infinity;
    for (const r of this.near(x, y)) {
      if (!ok(r)) continue;
      const c = this.cost(r, x, y);
      if (c < score) {
        score = c;
        best = r;
      }
    }
    return best;
  }

  /**
   * How firmly a point belongs to its cluster: the reach cost to the second-cheapest kept seed minus the cheapest.
   * Small near a border; the generator leaves sites under BORDER_GAP empty, which spaces clusters apart.
   */
  margin(x: number, y: number): number {
    let a = Infinity;
    let b = Infinity;
    for (const r of this.near(x, y)) {
      if (!this.kept(r)) continue;
      const c = this.cost(r, x, y);
      if (c < a) {
        b = a;
        a = c;
      } else if (c < b) b = c;
    }
    return b - a;
  }

  /** First pass: the cheapest seed of all. */
  private baseAt(x: number, y: number): Cluster | null {
    const key = `${x},${y}`;
    let r = this.base.get(key);
    if (r === undefined) {
      r = this.cheapest(x, y, () => true);
      this.base.set(key, r);
    }
    return r;
  }

  /** A cluster keeps its seed when the first pass gives it at least MIN_CLUSTER_SECTORS sectors (the start's always does). */
  private kept(r: Cluster): boolean {
    let v = this.keep.get(r.id);
    if (v === undefined) {
      let n = 0;
      for (const s of this.sites.sitesNear(r.x, r.y, CLUSTER_REACH)) if (this.baseAt(s.x, s.y) === r) n++;
      v = (r.rx === 0 && r.ry === 0) || n >= MIN_CLUSTER_SECTORS;
      this.keep.set(r.id, v);
    }
    return v;
  }

  /**
   * The cluster a point (a sector site) belongs to: the cheapest kept seed, so tiny clusters are absorbed by their
   * neighbours. Null when no seed reaches it. Memoised by exact position.
   */
  clusterAt(x: number, y: number): Cluster | null {
    const key = `${x},${y}`;
    let best = this.owner.get(key);
    if (best === undefined) {
      best = this.claim(x, y);
      if (best && this.wild(best, x, y)) best = null;
      this.owner.set(key, best);
    }
    return best;
  }

  /**
   * A cluster's hub: of its sectors within CLUSTER_REACH of the seed, the one scoring best on terrain density minus
   * distance from the seed. Null for a cluster left with no sectors.
   */
  hub(r: Cluster): { x: number; y: number } | null {
    let h = this.hubs.get(r.id);
    if (h === undefined) {
      h = null;
      let best = -Infinity;
      for (const site of this.sites.sitesNear(r.x, r.y, CLUSTER_REACH)) {
        if (this.clusterAt(site.x, site.y) !== r) continue;
        const score = this.terrain.density(site.x, site.y) - Math.hypot(site.x - r.x, site.y - r.y) / CLUSTER_REACH;
        if (score > best) {
          best = score;
          h = site;
        }
      }
      this.hubs.set(r.id, h);
    }
    return h;
  }

  /** True when the site at (x, y) is its cluster's hub. */
  isHub(x: number, y: number): boolean {
    const r = this.clusterAt(x, y);
    const h = r ? this.hub(r) : null;
    return !!h && h.x === x && h.y === y;
  }

  /** The cheapest kept seed (before the wild test). */
  private claim(x: number, y: number): Cluster | null {
    const key = `${x},${y}`;
    let r = this.claimed.get(key);
    if (r === undefined) {
      r = this.cheapest(x, y, (q) => this.kept(q)) ?? this.baseAt(x, y);
      this.claimed.set(key, r);
    }
    return r;
  }

  /**
   * Wild space: a sector its cluster only reaches across the void (more than WILD_VOID of it on the way from the seed),
   * or with fewer than WILD_MATES other sectors of that cluster within WILD_GAP. It belongs to no cluster and no faction: frontier.
   */
  private wild(r: Cluster, x: number, y: number): boolean {
    if (this.terrain.voidRun(r.x, r.y, x, y, LANE_MIN_DENSITY, 100).total > WILD_VOID) return true;
    const mates = this.sites.sitesNear(x, y, WILD_GAP).filter((o) => (o.x !== x || o.y !== y) && this.claim(o.x, o.y) === r);
    return mates.length < WILD_MATES;
  }

}
