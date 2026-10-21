import type { ChunkData, EdgeData, GalaxyContent, GalaxyIndex, NodeData, SectorData } from '../sim';
import type { UiStarLink, UiStarRegion } from '../ui/starmapApi';
import { fluidOutline, type P } from './starmapShapes';

const OPEN_SPACE = '#5a6b85';

export const REGION_TYPE_LABEL: Record<string, string> = {
  core: 'core worlds', border: 'border march', corporate: 'corporate holdings', trade: 'trade lanes',
  pirate: 'pirate haven', machine: 'machine dominion', frontier: 'frontier', rich: 'rich & contested',
};

// Generated data never changes: outlines are computed once per sector (and per region and sector count).
const sectorOutlines = new Map<string, string>();
const sectorPatches = new Map<string, string>();
const regionOutlines = new Map<string, string>();

/** A sector's fluid outline around its nodes and the routes between them (cached by sector). */
function outlineOf(s: SectorData, node: (id: string) => NodeData | undefined, routes: () => EdgeData[]): string {
  const key = `${s.id}@${s.x},${s.y}`;
  let d = sectorOutlines.get(key);
  if (d === undefined) {
    const pts = s.nodes.map(node).filter((n) => !!n).map((n): P => [n.x, n.y]);
    const links = routes().map((e): [P, P] => [[node(e.a)!.x, node(e.a)!.y], [node(e.b)!.x, node(e.b)!.y]]);
    d = fluidOutline(pts, links, 44, 8);
    if (sectorOutlines.size > 4000) sectorOutlines.clear();
    sectorOutlines.set(key, d);
  }
  return d;
}

/** Region-level patches: blob width (map units) and cut-off. */
const PATCH_SIGMA = 90;
const PATCH_CUT = 0.8;

/**
 * A sector's patch for the Region level: a rounder outline from wider blobs around its nodes alone, cut higher so it
 * keeps about the same size (cached by sector).
 */
function patchOf(s: SectorData, node: (id: string) => NodeData | undefined): string {
  const key = `${s.id}@${s.x},${s.y}`;
  let d = sectorPatches.get(key);
  if (d === undefined) {
    d = fluidOutline(s.nodes.map(node).filter((n) => !!n).map((n): P => [n.x, n.y]), [], PATCH_SIGMA, 16, PATCH_CUT);
    if (sectorPatches.size > 4000) sectorPatches.clear();
    sectorPatches.set(key, d);
  }
  return d;
}
/** A sector's Region-level patch, from the generated galaxy's index. */
export function sectorPatch(index: GalaxyIndex, s: SectorData): string {
  return patchOf(s, (id) => index.nodes.get(id));
}

/** A sector's outline, from the generated galaxy's index. */
export function sectorOutline(index: GalaxyIndex, s: SectorData): string {
  return outlineOf(s, (id) => index.nodes.get(id), () => {
    const mine = new Set(s.nodes);
    return s.nodes.flatMap((id) => (index.adjacent.get(id) ?? []).filter((e) => e.kind === 'route' && e.a === id && mine.has(e.b)));
  });
}

/** Compute and cache the outlines of a chunk's sectors ahead of time (the prefetcher calls this). */
export function warmOutlines(chunk: ChunkData): void {
  const nodes = new Map(chunk.nodes.map((n) => [n.id, n]));
  for (const s of chunk.sectors) {
    const mine = new Set(s.nodes);
    outlineOf(s, (id) => nodes.get(id), () => chunk.edges.filter((e) => e.kind === 'route' && mine.has(e.a) && mine.has(e.b)));
    patchOf(s, (id) => nodes.get(id));
  }
}

interface SectorPair {
  a: SectorData;
  b: SectorData;
  gate: boolean;
  rift: boolean;
}

/** Hyperlanes reduced to one link per sector pair. */
function sectorPairs(index: GalaxyIndex): SectorPair[] {
  const pairs = new Map<string, SectorPair>();
  for (const e of index.edges.values()) {
    if (e.kind !== 'hyperlane') continue;
    const a = index.sectors.get(index.nodes.get(e.a)?.sector ?? '');
    const b = index.sectors.get(index.nodes.get(e.b)?.sector ?? '');
    if (!a || !b || a === b) continue;
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    const p = pairs.get(key) ?? { a, b, gate: false, rift: false };
    p.gate ||= !!e.gate;
    p.rift ||= !!e.rift;
    pairs.set(key, p);
  }
  return [...pairs.values()];
}

/**
 * The outer zoom levels: regions (with fluid areas over their sectors), lanes between sectors, and links between
 * regions: their gates, plus one faint link per pair of regions a patch of unclaimed sectors joins (a minimum spanning
 * tree over the regions each patch touches).
 */
export function buildRegions(index: GalaxyIndex, content: GalaxyContent | undefined, known: (sector: string) => boolean, current: SectorData | undefined): {
  regions: UiStarRegion[];
  sectorLinks: UiStarLink[];
  regionLinks: UiStarLink[];
} {
  const pairs = sectorPairs(index);
  const members = new Map<string, SectorData[]>();
  for (const s of index.sectors.values()) if (s.region) members.set(s.region, [...(members.get(s.region) ?? []), s]);
  const regions: UiStarRegion[] = [];
  const centre = new Map<string, P>();
  for (const [id, list] of members) {
    const first = list[0]!;
    const x = list.reduce((t, s) => t + s.x, 0) / list.length;
    const y = list.reduce((t, s) => t + s.y, 0) / list.length;
    centre.set(id, [x, y]);
    const okey = `${id}#${list.length}`;
    let outline = regionOutlines.get(okey);
    if (outline === undefined) {
      const inner = pairs.filter((p) => p.a.region === id && p.b.region === id).map((p): [P, P] => [[p.a.x, p.a.y], [p.b.x, p.b.y]]);
      outline = fluidOutline(list.map((s): P => [s.x, s.y]), inner, 200, 36);
      if (regionOutlines.size > 2000) regionOutlines.clear();
      regionOutlines.set(okey, outline);
    }
    regions.push({
      id, name: first.regionName ?? id, type: first.regionType ?? '', typeLabel: REGION_TYPE_LABEL[first.regionType ?? ''] ?? '',
      faction: first.faction, color: (first.faction && content?.factions[first.faction]?.color) || OPEN_SPACE,
      x: Math.round(x), y: Math.round(y), sectors: list.length, outline, known: list.some((s) => known(s.id)),
      revealed: false, current: id === current?.region,
    });
  }
  const sectorLinks: UiStarLink[] = pairs.map((p) => ({
    id: `${p.a.id}|${p.b.id}`, ax: Math.round(p.a.x), ay: Math.round(p.a.y), bx: Math.round(p.b.x), by: Math.round(p.b.y),
    kind: p.rift ? 'rift' : p.gate ? 'gate' : 'lane', mine: p.a === current || p.b === current, count: 1,
  }));
  // Gates between regions.
  const regionLinks = new Map<string, UiStarLink>();
  const link = (ra: string, rb: string, kind: UiStarLink['kind']) => {
    const a = centre.get(ra);
    const b = centre.get(rb);
    if (!a || !b) return;
    const key = ra < rb ? `${ra}|${rb}` : `${rb}|${ra}`;
    const l = regionLinks.get(key);
    if (l) {
      if (kind !== 'through') l.count++;
      if (l.kind === 'rift' && kind === 'gate') l.kind = 'gate';
      return;
    }
    regionLinks.set(key, {
      id: key, ax: Math.round(a[0]), ay: Math.round(a[1]), bx: Math.round(b[0]), by: Math.round(b[1]), kind,
      mine: ra === current?.region || rb === current?.region, count: 1,
    });
  };
  for (const p of pairs) if (p.gate && p.a.region && p.b.region) link(p.a.region, p.b.region, p.rift ? 'rift' : 'gate');
  // Routes through unclaimed space: union the unclaimed sectors into patches, collect the regions each patch touches.
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  for (const s of index.sectors.values()) if (!s.region) parent.set(s.id, s.id);
  for (const p of pairs) if (!p.a.region && !p.b.region) parent.set(find(p.a.id), find(p.b.id));
  const touched = new Map<string, Set<string>>();
  for (const p of pairs) {
    const [wild, other] = !p.a.region && p.b.region ? [p.a, p.b] : !p.b.region && p.a.region ? [p.b, p.a] : [null, null];
    if (!wild || !other?.region) continue;
    const c = find(wild.id);
    touched.set(c, (touched.get(c) ?? new Set<string>()).add(other.region));
  }
  for (const set of touched.values()) {
    const ids = [...set].filter((id) => centre.has(id)).sort();
    const tree = new Set(ids.slice(0, 1));
    while (tree.size < ids.length) {
      let best: [string, string, number] | null = null;
      for (const a of tree) {
        for (const b of ids) {
          if (tree.has(b)) continue;
          const d = Math.hypot(centre.get(a)![0] - centre.get(b)![0], centre.get(a)![1] - centre.get(b)![1]);
          if (!best || d < best[2]) best = [a, b, d];
        }
      }
      tree.add(best![1]);
      link(best![0], best![1], 'through');
    }
  }
  // Regions next to the player's are revealed by name and type (their sectors stay unknown until sensors reach them).
  const next = new Set<string>();
  for (const l of regionLinks.values()) if (l.mine) for (const id of l.id.split('|')) next.add(id);
  for (const r of regions) r.revealed = r.known || next.has(r.id);
  return { regions, sectorLinks, regionLinks: [...regionLinks.values()] };
}
