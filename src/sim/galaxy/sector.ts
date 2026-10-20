import { Rng } from '../rng';
import { jumpCosts } from './costs';
import { inDanger, type GalaxyContent, type Weighted } from './defs';
import { dist, gabrielEdges, paddedHull, spanningTree, type Vec } from './geometry';
import { hash32, unit } from './hash';
import type { Site } from './sites';
import { dangerAt } from './territory';
import {
  CONTACT_MAX_CHANCE, CONTACT_PER_DANGER, HUB_NODES, HULL_PAD, NODE_DENSITY, NODE_MIN_DIST, NODES_PER_SECTOR, OPEN_STATION_CHANCE,
  ROUTE_EXTRA, TERRITORY_TRAFFIC,
} from './tuning';
import type { ContactSeed, EdgeData, NodeData, SectorData, StructureRef } from './types';

/** What a sector needs from the generator. */
export interface SectorContext {
  seed: number;
  content: GalaxyContent | undefined;
  /** Territory by position (the macro field: clusters carry factions). */
  territory: { factionAt(x: number, y: number): string | null };
  chunkOf(site: Site): string;
}

export interface BuiltSector {
  sector: SectorData;
  nodes: NodeData[];
  routes: EdgeData[];
}

const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi'];

/** Pick by weight with `u` in [0, 1). Null for an empty or weightless pool. */
export function pickWeighted<T>(pool: readonly Weighted<T>[], u: number): T | null {
  const total = pool.reduce((t, p) => t + Math.max(0, p.weight), 0);
  if (total <= 0) return null;
  let roll = u * total;
  for (const p of pool) if ((roll -= Math.max(0, p.weight)) < 0) return p.value;
  return (pool[pool.length - 1] as Weighted<T>).value;
}

/** Who a ship at a node belongs to: factions with traffic at this danger tier, the territory owner weighted up. */
export function trafficPool(content: GalaxyContent | undefined, owner: string | null, danger: number): Weighted[] {
  const pool: Weighted[] = [];
  for (const [id, f] of Object.entries(content?.factions ?? {})) {
    let w = f.traffic && inDanger(f.traffic.danger, danger) ? f.traffic.weight : 0;
    if (id === owner) w += TERRITORY_TRAFFIC;
    if (w > 0) pool.push({ value: id, weight: w });
  }
  return pool;
}

/** Node offsets inside the sector disc: Poisson-disk darts (the start sector's first node is pinned to its centre). */
function scatter(rng: Rng, site: Site, start: boolean, hub: boolean): Vec[] {
  const inner = Math.max(0, site.r - HULL_PAD);
  // Richness varies per sector on top of density, so sector sizes differ even inside one cluster.
  const per = (NODE_DENSITY.void + (NODE_DENSITY.core - NODE_DENSITY.void) * site.density) * (0.55 + 0.9 * rng.next());
  const want = Math.max(NODES_PER_SECTOR.min, Math.min(NODES_PER_SECTOR.max, Math.round(per * site.r * site.r * (hub ? HUB_NODES : 1))));
  const pts: Vec[] = start ? [{ x: 0, y: 0 }] : [];
  for (let tries = want * 40; pts.length < want && tries > 0; tries--) {
    const a = rng.next() * Math.PI * 2;
    const d = inner * Math.sqrt(rng.next());
    const p = { x: Math.cos(a) * d, y: Math.sin(a) * d };
    if (pts.every((q) => dist(p, q) >= NODE_MIN_DIST)) pts.push(p);
  }
  if (!pts.length) pts.push({ x: 0, y: 0 });
  return pts.map((p) => ({ x: site.x + p.x, y: site.y + p.y }));
}

function sectorName(seed: number, site: Site, content: GalaxyContent | undefined): { full: string; short: string } {
  const pre = content?.names.prefix ?? [];
  const suf = content?.names.suffix ?? [];
  if (!pre.length || !suf.length) return { full: site.id, short: site.id };
  const p = pre[hash32(seed, site.gx, site.gy, 41) % pre.length] as string;
  const s = suf[hash32(seed, site.gx, site.gy, 42) % suf.length] as string;
  return { full: `${p} ${s}`, short: p };
}

/** The structures of every node of the sector. */
function structuresFor(rng: Rng, ctx: SectorContext, nodes: readonly Vec[], faction: string | null, start: boolean): StructureRef[][] {
  const g = ctx.content;
  const out: StructureRef[][] = nodes.map(() => []);
  if (!g) return out;
  const civilian = Object.keys(g.factions).find((id) => g.factions[id]?.kind === 'civilian') ?? null;
  // The start node always has a free traders' station: fuel and a market within reach of a new game.
  if (start) out[0]?.push({ def: 'structure.station_trade', owner: civilian });
  const stations = faction ? g.factions[faction]?.stations ?? [] : [];
  const lo = start && nodes.length > 1 ? 1 : 0;
  const at = rng.int(lo, nodes.length - 1);
  if (stations.length) {
    const def = pickWeighted(stations, rng.next());
    if (def && g.structures[def]) out[at]?.push({ def, owner: faction });
  } else if (rng.chance(OPEN_STATION_CHANCE) && g.structures['structure.station_trade']) {
    out[at]?.push({ def: 'structure.station_trade', owner: civilian });
  }
  nodes.forEach((p, k) => {
    const danger = dangerAt(p.x, p.y);
    for (const [id, def] of Object.entries(g.structures)) {
      if (def.kind === 'station' || def.chance === undefined) continue;
      if (start && k === 0 && def.kind === 'derelict') continue;
      if (rng.chance(def.chance + (def.perDanger ?? 0) * danger)) out[k]?.push({ def: id, owner: def.kind === 'derelict' ? null : faction });
    }
  });
  return out;
}

/**
 * Build one sector from its site: nodes (positions, names, structures, ships present) and the routes between them. A hub
 * (its region's crossroads) gets HUB_NODES times the nodes.
 */
export function buildSector(ctx: SectorContext, site: Site, hub = false): BuiltSector {
  const start = site.gx === 0 && site.gy === 0;
  const rng = new Rng(hash32(ctx.seed, site.gx, site.gy, 21));
  const pts = scatter(rng, site, start, hub);
  const faction = ctx.territory.factionAt(site.x, site.y);
  const danger = dangerAt(site.x, site.y);
  const name = sectorName(ctx.seed, site, ctx.content);
  const structures = structuresFor(rng, ctx, pts, faction, start);
  const nodes: NodeData[] = pts.map((p, k) => {
    const nodeDanger = dangerAt(p.x, p.y);
    const contacts: ContactSeed[] = [];
    if (!(start && k === 0) && rng.chance(Math.min(CONTACT_MAX_CHANCE, CONTACT_PER_DANGER * nodeDanger))) {
      const who = pickWeighted(trafficPool(ctx.content, faction, nodeDanger), rng.next());
      const seed = rng.int(0, 0x7fffffff);
      if (who) contacts.push({ faction: who, seed, depth: nodeDanger });
    }
    const list = structures[k] ?? [];
    const resources = [...new Set(list.flatMap((s) => ctx.content?.structures[s.def]?.resources ?? []))].sort();
    return {
      id: `${site.id}.n${k}`, sector: site.id, x: p.x, y: p.y, name: `${name.short} ${GREEK[k % GREEK.length]}`,
      danger: nodeDanger, faction, structures: list, resources, contacts,
    };
  });
  const routes: EdgeData[] = [];
  const cand = gabrielEdges(pts);
  const tree = new Set(spanningTree(pts, cand).map(([i, j]) => `${i},${j}`));
  for (const [i, j] of cand) {
    if (!tree.has(`${i},${j}`) && unit(ctx.seed, site.gx, site.gy, i, j, 31) >= ROUTE_EXTRA) continue;
    const a = nodes[i] as NodeData;
    const b = nodes[j] as NodeData;
    const [lo, hi] = a.id < b.id ? [a, b] : [b, a];
    const length = dist(a, b);
    routes.push({ id: `r:${lo.id}|${hi.id}`, a: lo.id, b: hi.id, kind: 'route', length, ...jumpCosts('route', length) });
  }
  const sector: SectorData = {
    id: site.id, chunk: ctx.chunkOf(site), x: site.x, y: site.y, r: site.r, name: name.full, faction, danger,
    nodes: nodes.map((n) => n.id), hull: paddedHull(pts, HULL_PAD), ...(hub ? { hub: true as const } : {}),
  };
  return { sector, nodes, routes };
}
