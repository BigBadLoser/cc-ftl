import { jumpCosts } from './costs';
import type { GalaxyContent } from './defs';
import { dist, isGabriel, isRelativeNeighbour, type Vec } from './geometry';
import { strHash, unit } from './hash';
import { buildSector, type BuiltSector, type SectorContext } from './sector';
import { MacroField } from './macro';
import { SiteField, type Site } from './sites';
import { TerritoryField } from './territory';
import { ANCHOR_CHANCE, CHUNK_CELLS, HYPERLANE_EXTRA, HYPERLANE_MAX, LANE_MAX_VOID, LANE_MIN_DENSITY, SITE_CELL } from './tuning';
import type { ChunkData, EdgeData, NodeData } from './types';

export const chunkKey = (cx: number, cy: number): string => `${cx},${cy}`;
/** The chunk of a global site cell. */
export const chunkOfCell = (g: number): number => Math.floor(g / CHUNK_CELLS);

/** Parse `s.<gx>.<gy>` (or a node id starting with it) to its cell. */
export function cellOfId(id: string): { gx: number; gy: number } | null {
  const m = /^s\.(-?\d+)\.(-?\d+)/.exec(id);
  return m ? { gx: Number(m[1]), gy: Number(m[2]) } : null;
}

/** The chunk key holding a sector or node id. */
export function chunkOfId(id: string): string | null {
  const c = cellOfId(id);
  return c ? chunkKey(chunkOfCell(c.gx), chunkOfCell(c.gy)) : null;
}

/** The chunk a map position falls in (by its site cell). */
export function chunkAt(x: number, y: number): { cx: number; cy: number } {
  return { cx: chunkOfCell(Math.floor(x / SITE_CELL + 0.5)), cy: chunkOfCell(Math.floor(y / SITE_CELL + 0.5)) };
}

/**
 * The endless galaxy generator for one (seed, content). It is a cache over pure functions: sites and territory are
 * functions of (seed, cell), a sector of its site, a hyperlane of its two sites. So chunks may be generated in any order
 * and a hyperlane that crosses a chunk border comes out identical from either side. Not saved: rebuilt on demand.
 */
export class GalaxyGen implements SectorContext {
  get territory(): MacroField {
    return this.macro;
  }

  readonly sites: SiteField;
  readonly macro: MacroField;
  private sectors = new Map<string, BuiltSector>();

  constructor(
    readonly seed: number,
    readonly content: GalaxyContent | undefined,
  ) {
    this.macro = new MacroField(seed, new TerritoryField(seed, content?.factions ?? {}));
    this.sites = new SiteField(seed, this.macro);
  }

  chunkOf(site: Site): string {
    return chunkKey(chunkOfCell(site.gx), chunkOfCell(site.gy));
  }

  sector(site: Site): BuiltSector {
    let s = this.sectors.get(site.id);
    if (!s) {
      s = buildSector(this, site);
      this.sectors.set(site.id, s);
    }
    return s;
  }

  /** The node of a sector facing direction (dx, dy): furthest along it, slightly favouring the rim. */
  private gateway(site: Site, dx: number, dy: number): NodeData {
    let best: NodeData | null = null;
    let score = -Infinity;
    for (const n of this.sector(site).nodes) {
      const rx = n.x - site.x;
      const ry = n.y - site.y;
      const s = rx * dx + ry * dy + 0.1 * Math.hypot(rx, ry);
      if (s > score) {
        score = s;
        best = n;
      }
    }
    return best as NodeData;
  }

  /** True unless a-b crosses more than LANE_MAX_VOID of void (density below LANE_MIN_DENSITY): lanes never span voids. */
  private laneClear(a: Vec, b: Vec): boolean {
    const steps = Math.ceil(dist(a, b) / 50);
    const stepLen = dist(a, b) / steps;
    let run = 0;
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      run = this.macro.density(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) < LANE_MIN_DENSITY ? run + stepLen : 0;
      if (run > LANE_MAX_VOID) return false;
    }
    return true;
  }

  /**
   * Hyperlanes of a sector. Candidates are the sites within HYPERLANE_MAX. A pair is linked when it is a relative
   * neighbourhood edge (the connected backbone; it contains the minimum spanning tree) or, with HYPERLANE_EXTRA chance
   * from a symmetric pair hash, a Gabriel edge. Both tests read only sites within |ab| of each end, which both ends'
   * candidate lists contain, so the answer is the same from either sector.
   */
  hyperlanes(site: Site): EdgeData[] {
    const near = this.sites.sitesNear(site.x, site.y, HYPERLANE_MAX);
    const out: EdgeData[] = [];
    for (const other of near) {
      if (other.id === site.id) continue;
      const [a, b] = site.id < other.id ? [site, other] : [other, site];
      const pts: Vec[] = near;
      const rng = isRelativeNeighbour(a, b, pts);
      const ha = strHash(a.id);
      const hb = strHash(b.id);
      if (!rng && !(isGabriel(a, b, pts) && unit(this.seed, ha, hb, 51) < HYPERLANE_EXTRA)) continue;
      if (!this.laneClear(a, b)) continue;
      const len = dist(a, b) || 1;
      const ga = this.gateway(a, (b.x - a.x) / len, (b.y - a.y) / len);
      const gb = this.gateway(b, (a.x - b.x) / len, (a.y - b.y) / len);
      const length = dist(ga, gb);
      const edge: EdgeData = { id: `h:${a.id}|${b.id}`, a: ga.id, b: gb.id, kind: 'hyperlane', length, ...jumpCosts('hyperlane', length) };
      if (unit(this.seed, ha, hb, 52) < ANCHOR_CHANCE) edge.anchor = true;
      out.push(edge);
    }
    return out;
  }

  /** Generate one chunk: its sectors (sites whose cell is in it), their nodes and routes, and their hyperlanes. */
  chunk(cx: number, cy: number): ChunkData {
    const data: ChunkData = { key: chunkKey(cx, cy), cx, cy, sectors: [], nodes: [], edges: [] };
    const seen = new Set<string>();
    for (let gy = cy * CHUNK_CELLS; gy < (cy + 1) * CHUNK_CELLS; gy++) {
      for (let gx = cx * CHUNK_CELLS; gx < (cx + 1) * CHUNK_CELLS; gx++) {
        const site = this.sites.site(gx, gy);
        if (!site) continue;
        const built = this.sector(site);
        data.sectors.push(built.sector);
        data.nodes.push(...built.nodes);
        for (const e of [...built.routes, ...this.hyperlanes(site)]) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          data.edges.push(e);
        }
      }
    }
    return data;
  }
}

const gens = new WeakMap<object, Map<number, GalaxyGen>>();
const NO_CONTENT = {};

/** The shared generator for a (content, seed) pair. */
export function galaxyGen(seed: number, content: GalaxyContent | undefined): GalaxyGen {
  const key = content ?? NO_CONTENT;
  let bySeed = gens.get(key);
  if (!bySeed) gens.set(key, (bySeed = new Map()));
  let g = bySeed.get(seed);
  if (!g) {
    if (bySeed.size > 16) bySeed.clear();
    bySeed.set(seed, (g = new GalaxyGen(seed, content)));
  }
  return g;
}
