import { jumpCosts } from './costs';
import type { GalaxyContent } from './defs';
import { dist, isGabriel, isRelativeNeighbour } from './geometry';
import { strHash, unit } from './hash';
import { buildSector, type BuiltSector, type SectorContext } from './sector';
import { RegionField, type Region } from './regions';
import { SiteField, type Site } from './sites';
import { Terrain } from './terrain';
import { TerritoryField } from './territory';
import {
  ANCHOR_CHANCE, CHUNK_CELLS, GATE_SECOND, GATE_SPREAD, GATE_THIRD, HYPERLANE_MAX, LANE_MAX_VOID,
  LANE_MIN_DENSITY, LOOP_CHANCE, NO_GATE, REGION_CELL, REGION_REACH, RIFT_GATE_PENALTY, RIFT_MAX, SITE_CELL,
} from './tuning';
import type { ChunkData, EdgeData, NodeData } from './types';

interface Candidate {
  site: Site;
  /** Crosses the void (a rift lane). */
  rift: boolean;
}

interface Crossing {
  id: string;
  len: number;
  mx: number;
  my: number;
}

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
  readonly terrain: Terrain;
  readonly regions: RegionField;
  readonly sites: SiteField;
  /** Territory by position: the faction of the region there. */
  readonly territory = { factionAt: (x: number, y: number): string | null => this.regions.regionAt(x, y)?.faction ?? null };
  private sectors = new Map<string, BuiltSector>();
  private cands = new Map<string, Candidate[]>();
  private gateSets = new Map<string, Set<string>>();
  private cross = new Map<string, Crossing[]>();
  private links = new Map<string, Site[]>();

  constructor(
    readonly seed: number,
    readonly content: GalaxyContent | undefined,
  ) {
    this.terrain = new Terrain(seed);
    this.sites = new SiteField(seed, this.terrain);
    this.regions = new RegionField(seed, this.terrain, this.sites, new TerritoryField(seed, content?.factions ?? {}), content);
  }

  chunkOf(site: Site): string {
    return chunkKey(chunkOfCell(site.gx), chunkOfCell(site.gy));
  }

  sector(site: Site): BuiltSector {
    let s = this.sectors.get(site.id);
    if (!s) {
      s = buildSector(this, site);
      const region = this.regions.regionAt(site.x, site.y);
      if (region) s.sector.region = region.id;
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

  /** True when a-b stays out of the void: no stretch over LANE_MAX_VOID below LANE_MIN_DENSITY, and short enough. */
  private clear(a: Site, b: Site): boolean {
    return dist(a, b) <= HYPERLANE_MAX && this.terrain.voidRun(a.x, a.y, b.x, b.y, LANE_MIN_DENSITY).longest <= LANE_MAX_VOID;
  }

  /**
   * Lane candidates of a site: Gabriel pairs that stay out of the void, plus **rift lanes**: relative neighbourhood
   * pairs (within RIFT_MAX) that cross it. The relative neighbourhood graph is connected, so no island of sectors is
   * ever stranded. The tests read only sites within |ab| of each end, which both ends' lists hold: symmetric.
   */
  private candidates(site: Site): Candidate[] {
    let out = this.cands.get(site.id);
    if (!out) {
      out = [];
      const near = this.sites.sitesNear(site.x, site.y, RIFT_MAX);
      for (const o of near) {
        if (o.id === site.id) continue;
        const [a, b] = site.id < o.id ? [site, o] : [o, site];
        if (this.clear(a, b)) {
          if (isGabriel(a, b, near)) out.push({ site: o, rift: false });
        } else if (isRelativeNeighbour(a, b, near)) out.push({ site: o, rift: true });
      }
      this.cands.set(site.id, out);
    }
    return out;
  }

  /** Crossing candidates between two regions (lane id, length, midpoint), shortest first. Reads sites near a's seed. */
  private crossings(ra: Region, rb: Region): Crossing[] {
    const [a, b] = ra.id < rb.id ? [ra, rb] : [rb, ra];
    const key = `${a.id}|${b.id}`;
    let out = this.cross.get(key);
    if (!out) {
      out = [];
      for (const s of this.sites.sitesNear(a.x, a.y, REGION_REACH)) {
        if (this.regions.regionAt(s.x, s.y) !== a) continue;
        for (const { site: o, rift } of this.candidates(s)) {
          if (this.regions.regionAt(o.x, o.y) !== b) continue;
          const id = s.id < o.id ? `${s.id}|${o.id}` : `${o.id}|${s.id}`;
          out.push({ id, len: dist(s, o) + (rift ? RIFT_GATE_PENALTY : 0), mx: (s.x + o.x) / 2, my: (s.y + o.y) / 2 });
        }
      }
      out.sort((p, q) => p.len - q.len || (p.id < q.id ? -1 : 1));
      this.cross.set(key, out);
    }
    return out;
  }

  /**
   * May the border between two touching regions close? Only when a third region touches both through two shorter
   * borders (by seed distance), so there is always a way around: the kept borders contain a spanning tree of the
   * touching regions, the same argument that makes relative neighbourhood graphs connected.
   */
  private detour(a: Region, b: Region): boolean {
    const dab = dist(a, b);
    const ring = Math.ceil((2 * REGION_REACH) / REGION_CELL) + 1;
    return this.regions.near((a.x + b.x) / 2, (a.y + b.y) / 2, ring).some((c) => c !== a && c !== b
      && Math.max(dist(a, c), dist(b, c)) < dab && this.crossings(a, c).length > 0 && this.crossings(b, c).length > 0);
  }

  /**
   * The gates between two neighbouring regions: lane ids (`a|b`) of the crossing candidates kept. One, plus a second
   * and third by chance, picked shortest first and GATE_SPREAD apart; none (NO_GATE chance) when a detour exists, so
   * some borders are closed and you go around. Pure in the two regions' surroundings: the same from both sides.
   */
  private gates(ra: Region, rb: Region): Set<string> {
    const [a, b] = ra.id < rb.id ? [ra, rb] : [rb, ra];
    const key = `${a.id}|${b.id}`;
    let out = this.gateSets.get(key);
    if (!out) {
      out = new Set();
      const u = (salt: number) => unit(this.seed, a.rx, a.ry, b.rx, b.ry, salt);
      const want = u(91) < NO_GATE && this.detour(a, b) ? 0 : 1 + (u(92) < GATE_SECOND ? 1 : 0) + (u(93) < GATE_THIRD ? 1 : 0);
      const picked: Crossing[] = [];
      for (const c of this.crossings(a, b)) {
        if (picked.length >= want) break;
        if (picked.every((p) => Math.hypot(p.mx - c.mx, p.my - c.my) >= GATE_SPREAD)) picked.push(c);
      }
      for (const p of picked) out.add(p.id);
      this.gateSets.set(key, out);
    }
    return out;
  }

  /** The lane between two sites (gateway nodes facing each other). */
  private lane(a: Site, b: Site, gate: boolean, rift: boolean): EdgeData {
    const len = dist(a, b) || 1;
    const ga = this.gateway(a, (b.x - a.x) / len, (b.y - a.y) / len);
    const gb = this.gateway(b, (a.x - b.x) / len, (a.y - b.y) / len);
    const length = dist(ga, gb);
    const edge: EdgeData = { id: `h:${a.id}|${b.id}`, a: ga.id, b: gb.id, kind: 'hyperlane', length, ...jumpCosts('hyperlane', length) };
    if (gate) edge.gate = true;
    if (rift) edge.rift = true;
    if (unit(this.seed, strHash(a.id), strHash(b.id), 52) < ANCHOR_CHANCE) edge.anchor = true;
    return edge;
  }

  /**
   * Hyperlanes of a sector. Inside its region, a spanning tree of the region's backbone (see treeEdge) plus LOOP_CHANCE
   * of the other backbone links as loops: some choice, some chokepoints. Across a border, only the gates. A wild
   * sector (no region) keeps its relative-neighbour lanes, which never cut the frontier off.
   */
  hyperlanes(site: Site): EdgeData[] {
    const out: EdgeData[] = [];
    const mine = this.regions.regionAt(site.x, site.y);
    const cands = this.candidates(site);
    const near = this.sites.sitesNear(site.x, site.y, RIFT_MAX);
    for (const { site: other, rift } of cands) {
      if (mine && this.regions.regionAt(other.x, other.y)) continue;
      const [a, b] = site.id < other.id ? [site, other] : [other, site];
      if (isRelativeNeighbour(a, b, near)) out.push(this.lane(a, b, false, rift));
    }
    if (!mine) return out;
    for (const other of this.regionLinks(site)) {
      const [a, b] = site.id < other.id ? [site, other] : [other, site];
      if (!this.treeEdge(a, b) && unit(this.seed, strHash(a.id), strHash(b.id), 51) >= LOOP_CHANCE) continue;
      out.push(this.lane(a, b, false, !this.clear(a, b)));
    }
    for (const { site: other, rift } of cands) {
      const theirs = this.regions.regionAt(other.x, other.y);
      if (!theirs || theirs === mine) continue;
      const [a, b] = site.id < other.id ? [site, other] : [other, site];
      if (this.gates(mine, theirs).has(`${a.id}|${b.id}`)) out.push(this.lane(a, b, true, rift));
    }
    return out;
  }

  /** Relative neighbourhood links of a site among its own region's sites (a connected backbone per region). */
  private regionLinks(site: Site): Site[] {
    let out = this.links.get(site.id);
    if (!out) {
      const mine = this.regions.regionAt(site.x, site.y);
      const same = this.sites.sitesNear(site.x, site.y, RIFT_MAX).filter((o) => this.regions.regionAt(o.x, o.y) === mine);
      out = same.filter((o) => o.id !== site.id && isRelativeNeighbour(site, o, same));
      this.links.set(site.id, out);
    }
    return out;
  }

  /**
   * Is a-b a spanning-tree link of its region? Yes unless a path of strictly shorter backbone links (ties by id) joins
   * a and b inside the disc of radius 2.5|ab| around their midpoint. A dropped link always has such a detour, so by
   * induction on length the kept links still connect the region; the disc keeps the test local and symmetric.
   */
  private treeEdge(a: Site, b: Site): boolean {
    const len = dist(a, b);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const shorter = (p: Site, q: Site) => {
      const d = dist(p, q);
      if (d !== len) return d < len;
      const k = p.id < q.id ? `${p.id}|${q.id}` : `${q.id}|${p.id}`;
      return k < `${a.id}|${b.id}`;
    };
    const seen = new Set([a.id]);
    const todo = [a];
    while (todo.length) {
      const p = todo.pop() as Site;
      for (const q of this.regionLinks(p)) {
        if (seen.has(q.id) || Math.hypot(q.x - mx, q.y - my) > 2.5 * len || !shorter(p, q)) continue;
        if (q.id === b.id) return false;
        seen.add(q.id);
        todo.push(q);
      }
    }
    return true;
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
