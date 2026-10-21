import type { GalaxyContent } from './defs';
import { hash32, unit } from './hash';
import type { Terrain } from './terrain';
import { dangerAt, type TerritoryField } from './territory';
import {
  LANE_MIN_DENSITY, MIN_REGION_SECTORS, REGION_BORDER_WOBBLE, REGION_CELL, REGION_REACH, REGION_RIFT_COST, REGION_SEED_DENSITY, WILD_GAP, WILD_MATES, WILD_VOID,
} from './tuning';

/** A region (province): a named group of sectors around a seed, owned by one faction or by nobody. */
export interface Region {
  id: string;
  rx: number;
  ry: number;
  x: number;
  y: number;
  name: string;
  faction: string | null;
  /** What to expect there (regionType): core, border, corporate, trade, pirate, machine, frontier or rich. */
  type: RegionType;
}

export type RegionType = 'core' | 'border' | 'corporate' | 'trade' | 'pirate' | 'machine' | 'frontier' | 'rich';

const JITTER = 0.35;
const RING = Math.ceil(REGION_REACH / REGION_CELL + 0.5 + JITTER);
const cellOf = (v: number): number => Math.floor(v / REGION_CELL + 0.5);

/**
 * Regions over the terrain: one seed per REGION_CELL cell, placed on dense ground (a cell over a rift has none). A
 * point belongs to the seed it is cheapest to reach, where distance is wobbled by noise and every unit of void on the
 * way costs REGION_RIFT_COST extra, so borders follow the rifts. A seed that would get fewer than MIN_REGION_SECTORS
 * sectors is dropped and its sectors join their next-cheapest region. All of it reads a bounded ring of cells: chunk-safe.
 */
export class RegionField {
  private regions = new Map<string, Region | null>();
  private owner = new Map<string, Region | null>();
  private base = new Map<string, Region | null>();
  private keep = new Map<string, boolean>();
  private claimed = new Map<string, Region | null>();
  private hubs = new Map<string, { x: number; y: number } | null>();

  constructor(
    readonly seed: number,
    private readonly terrain: Terrain,
    private readonly sites: { sitesNear(x: number, y: number, range: number): readonly { x: number; y: number }[] },
    private readonly territory: TerritoryField,
    private readonly content: GalaxyContent | undefined,
  ) {}

  region(rx: number, ry: number): Region | null {
    const key = `${rx},${ry}`;
    let r = this.regions.get(key);
    if (r === undefined) {
      r = null;
      for (let k = 0; k < 4 && !r; k++) {
        const home = rx === 0 && ry === 0;
        const x = home ? 0 : (rx + (unit(this.seed, rx, ry, k, 81) * 2 - 1) * JITTER) * REGION_CELL;
        const y = home ? 0 : (ry + (unit(this.seed, rx, ry, k, 82) * 2 - 1) * JITTER) * REGION_CELL;
        if (!home && this.terrain.density(x, y) < REGION_SEED_DENSITY) continue;
        const faction = this.territory.factionAt(x, y);
        r = { id: `g.${rx}.${ry}`, rx, ry, x, y, name: this.nameOf(rx, ry), faction, type: this.typeOf(faction, x, y) };
      }
      this.regions.set(key, r);
    }
    return r;
  }

  /**
   * A region's type, from its owner's kind, its danger and its terrain: a government's safe space is its core and its
   * dangerous space a border march; unclaimed dense space is rich (and contested), sparse space frontier.
   */
  private typeOf(faction: string | null, x: number, y: number): RegionType {
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

  /** Regions whose seed cell lies within `ring` cells of the cell holding (x, y). */
  near(x: number, y: number, ring = RING): Region[] {
    const out: Region[] = [];
    const cx = cellOf(x);
    const cy = cellOf(y);
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        const r = this.region(cx + dx, cy + dy);
        if (r) out.push(r);
      }
    }
    return out;
  }

  /** Cost of reaching (x, y) from a region's seed. */
  cost(r: Region, x: number, y: number): number {
    const d = Math.hypot(x - r.x, y - r.y);
    if (d > REGION_REACH) return Infinity;
    const wob = 1 + REGION_BORDER_WOBBLE * (this.terrain.wobble(x, y, 1400, hash32(r.rx, r.ry) % 997) - 0.5) * 2;
    return d * wob + REGION_RIFT_COST * this.terrain.voidRun(r.x, r.y, x, y, LANE_MIN_DENSITY, 100).total;
  }

  /** The cheapest seed to reach (x, y) among those passing `ok`. */
  private cheapest(x: number, y: number, ok: (r: Region) => boolean): Region | null {
    let best: Region | null = null;
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
   * How firmly a point belongs to its region: the reach cost to the second-cheapest kept seed minus the cheapest.
   * Small near a border; the generator leaves sites under BORDER_GAP empty, which spaces regions apart.
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
  private baseAt(x: number, y: number): Region | null {
    const key = `${x},${y}`;
    let r = this.base.get(key);
    if (r === undefined) {
      r = this.cheapest(x, y, () => true);
      this.base.set(key, r);
    }
    return r;
  }

  /** A region keeps its seed when the first pass gives it at least MIN_REGION_SECTORS sectors (the start's always does). */
  private kept(r: Region): boolean {
    let v = this.keep.get(r.id);
    if (v === undefined) {
      let n = 0;
      for (const s of this.sites.sitesNear(r.x, r.y, REGION_REACH)) if (this.baseAt(s.x, s.y) === r) n++;
      v = (r.rx === 0 && r.ry === 0) || n >= MIN_REGION_SECTORS;
      this.keep.set(r.id, v);
    }
    return v;
  }

  /**
   * The region a point (a sector site) belongs to: the cheapest kept seed, so tiny regions are absorbed by their
   * neighbours. Null when no seed reaches it. Memoised by exact position.
   */
  regionAt(x: number, y: number): Region | null {
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
   * A region's hub: of its sectors within REGION_REACH of the seed, the one scoring best on terrain density minus
   * distance from the seed. Null for a region left with no sectors.
   */
  hub(r: Region): { x: number; y: number } | null {
    let h = this.hubs.get(r.id);
    if (h === undefined) {
      h = null;
      let best = -Infinity;
      for (const s of this.sites.sitesNear(r.x, r.y, REGION_REACH)) {
        if (this.regionAt(s.x, s.y) !== r) continue;
        const score = this.terrain.density(s.x, s.y) - Math.hypot(s.x - r.x, s.y - r.y) / REGION_REACH;
        if (score > best) {
          best = score;
          h = s;
        }
      }
      this.hubs.set(r.id, h);
    }
    return h;
  }

  /** True when the site at (x, y) is its region's hub. */
  isHub(x: number, y: number): boolean {
    const r = this.regionAt(x, y);
    const h = r ? this.hub(r) : null;
    return !!h && h.x === x && h.y === y;
  }

  /** The cheapest kept seed (before the wild test). */
  private claim(x: number, y: number): Region | null {
    const key = `${x},${y}`;
    let r = this.claimed.get(key);
    if (r === undefined) {
      r = this.cheapest(x, y, (q) => this.kept(q)) ?? this.baseAt(x, y);
      this.claimed.set(key, r);
    }
    return r;
  }

  /**
   * Wild space: a sector its region only reaches across the void (more than WILD_VOID of it on the way from the seed),
   * or with fewer than WILD_MATES other sectors of that region within WILD_GAP. It belongs to no region and no faction: frontier.
   */
  private wild(r: Region, x: number, y: number): boolean {
    if (this.terrain.voidRun(r.x, r.y, x, y, LANE_MIN_DENSITY, 100).total > WILD_VOID) return true;
    const mates = this.sites.sitesNear(x, y, WILD_GAP).filter((o) => (o.x !== x || o.y !== y) && this.claim(o.x, o.y) === r);
    return mates.length < WILD_MATES;
  }

}
