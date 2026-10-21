/**
 * Dev-only zoomed-out starmap previews (nothing in src/ imports this), the two outer levels of the semantic zoom:
 * - level 2: sectors as icons (body + name), lanes between sectors, regions as fluid areas;
 * - level 3: regions as single nodes (sized by sectors, tinted by owner), joined where gates cross their border.
 */
import { galaxyGen, type EdgeData, type NodeData, type SectorData } from '../../src/sim';
import { content } from '../../src/content';
import { REGION_TYPE, SOFT_DEFS, W, H, bodySvg, factions, fluidBorder, type P } from './sectorview';

interface World {
  sectors: Map<string, SectorData>;
  nodes: Map<string, NodeData>;
  edges: Map<string, EdgeData>;
}

function world(seed: number, radius: number): World {
  const gen = galaxyGen(seed, content.galaxy);
  const w: World = { sectors: new Map(), nodes: new Map(), edges: new Map() };
  for (let cy = -radius; cy <= radius; cy++) {
    for (let cx = -radius; cx <= radius; cx++) {
      const c = gen.chunk(cx, cy);
      for (const s of c.sectors) w.sectors.set(s.id, s);
      for (const n of c.nodes) w.nodes.set(n.id, n);
      for (const e of c.edges) w.edges.set(e.id, e);
    }
  }
  return w;
}

/** Hyperlanes reduced to sector pairs. */
function sectorLinks(w: World): { a: SectorData; b: SectorData; e: EdgeData }[] {
  const out: { a: SectorData; b: SectorData; e: EdgeData }[] = [];
  for (const e of w.edges.values()) {
    if (e.kind !== 'hyperlane') continue;
    const a = w.sectors.get(w.nodes.get(e.a)?.sector ?? '');
    const b = w.sectors.get(w.nodes.get(e.b)?.sector ?? '');
    if (a && b) out.push({ a, b, e });
  }
  return out;
}

const colOf = (faction: string | null | undefined) => (faction ? factions[faction]?.color ?? '#94a3b8' : '#94a3b8');
const font = 'font-family="Trebuchet MS,sans-serif"';

function frame(seed: number): string[] {
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`, SOFT_DEFS, `<rect width="${W}" height="${H}" fill="#05070d"/>`];
  let s0 = seed * 7919 + 5;
  const rnd = () => ((s0 = (s0 * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 320; i++) out.push(`<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(rnd() * 0.8 + 0.2).toFixed(2)}" fill="#fff" opacity="${(rnd() * 0.35 + 0.08).toFixed(2)}"/>`);
  return out;
}

/** Level 2: the neighbourhood, about `span` units across, centred on a sector. */
export function regionView(seed: number, sectorId = 's.0.0', span = 7000): string {
  const w = world(seed, 4);
  const here = w.sectors.get(sectorId);
  if (!here) throw new Error(`no sector ${sectorId}`);
  const k = H / span;
  const map = (p: P): P => [W / 2 + (p[0] - here.x) * k, H / 2 + (p[1] - here.y) * k];
  const on = (s: SectorData) => {
    const [x, y] = map([s.x, s.y]);
    return x > -150 && x < W + 150 && y > -150 && y < H + 150;
  };
  const out = frame(seed);
  const links = sectorLinks(w);
  // Regions as fluid areas over their sectors and the lanes inside them.
  const byRegion = new Map<string, SectorData[]>();
  for (const s of w.sectors.values()) if (s.region && on(s)) byRegion.set(s.region, [...(byRegion.get(s.region) ?? []), s]);
  for (const [id, list] of byRegion) {
    const inner = links.filter((l) => l.a.region === id && l.b.region === id).map((l): [P, P] => [[l.a.x, l.a.y], [l.b.x, l.b.y]]);
    const col = colOf(list[0]!.faction);
    const d = fluidBorder(list.map((s): P => [s.x, s.y]), inner, 260, 40, map);
    out.push(`<path d="${d}" fill="${col}" fill-opacity="0.07" stroke="${col}" stroke-opacity="0.45" stroke-width="1.5" fill-rule="evenodd"/>`);
  }
  // Lanes between sectors: gates bright and thick, rifts dotted.
  for (const { a, b, e } of links) {
    if (!on(a) && !on(b)) continue;
    const [ax, ay] = map([a.x, a.y]);
    const [bx, by] = map([b.x, b.y]);
    const mine = a.id === here.id || b.id === here.id;
    const col = e.rift ? '#a78bfa' : mine ? '#4ade80' : e.gate ? '#7dd3fc' : '#64748b';
    out.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${col}" stroke-opacity="${mine || e.gate ? 0.9 : 0.5}" stroke-width="${e.gate || mine ? 2.6 : 1.3}"${e.rift ? ' stroke-dasharray="2 5"' : ''}/>`);
  }
  const near = new Set(links.filter((l) => l.a.id === here.id || l.b.id === here.id).map((l) => (l.a.id === here.id ? l.b.id : l.a.id)));
  // Sectors as icons: body plus name.
  for (const s of w.sectors.values()) {
    if (!on(s)) continue;
    const [x, y] = map([s.x, s.y]);
    out.push(bodySvg(s.body?.kind ?? 'star', x, y, s.id === here.id ? 7 : 5));
    if (s.id === here.id) out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="none" stroke="#22d3ee" stroke-width="2.5"/>`);
    // Only your sector and its neighbours are named at this zoom; regions carry the rest.
    if (s.id === here.id || near.has(s.id)) out.push(`<text x="${x.toFixed(1)}" y="${(y + 19).toFixed(1)}" text-anchor="middle" ${font} font-size="11" letter-spacing="1" fill="${s.id === here.id ? '#22d3ee' : '#cbd5e1'}" stroke="#05070d" stroke-width="3" paint-order="stroke">${s.name}</text>`);
  }
  // Region labels at the centroid of their visible sectors.
  for (const list of byRegion.values()) {
    if (list.length < 2) continue;
    const s0 = list[0]!;
    const [x, y] = map([list.reduce((t, s) => t + s.x, 0) / list.length, list.reduce((t, s) => t + s.y, 0) / list.length]);
    out.push(`<text x="${x.toFixed(1)}" y="${(y - 26).toFixed(1)}" text-anchor="middle" ${font} font-size="15" letter-spacing="4" fill="${colOf(s0.faction)}" stroke="#05070d" stroke-width="4" paint-order="stroke">${(s0.regionName ?? '').toUpperCase()}</text>`);
    out.push(`<text x="${x.toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="middle" ${font} font-size="11" letter-spacing="1" fill="#94a3b8" stroke="#05070d" stroke-width="3" paint-order="stroke">${REGION_TYPE[s0.regionType ?? ''] ?? ''}</text>`);
  }
  out.push(`<text x="24" y="${H - 22}" ${font} font-size="13" letter-spacing="2" fill="#94a3b8">ZOOM 2/3 (sectors)  ·  green: lanes from your sector  ·  blue: gates between regions  ·  violet: rifts</text>`);
  out.push('</svg>');
  return out.join('\n');
}

/** Level 3: regions as nodes, linked where a gate crosses their border. */
export function galaxyView(seed: number, sectorId = 's.0.0', span = 26000): string {
  const w = world(seed, 9);
  const here = w.sectors.get(sectorId);
  if (!here) throw new Error(`no sector ${sectorId}`);
  const k = H / span;
  const map = (p: P): P => [W / 2 + (p[0] - here.x) * k, H / 2 + (p[1] - here.y) * k];
  const regions = new Map<string, { list: SectorData[]; x: number; y: number }>();
  for (const s of w.sectors.values()) {
    if (!s.region) continue;
    const r = regions.get(s.region) ?? { list: [], x: 0, y: 0 };
    r.list.push(s);
    regions.set(s.region, r);
  }
  for (const r of regions.values()) {
    r.x = r.list.reduce((t, s) => t + s.x, 0) / r.list.length;
    r.y = r.list.reduce((t, s) => t + s.y, 0) / r.list.length;
  }
  const out = frame(seed);
  const gates = new Map<string, { a: string; b: string; n: number; rift: boolean }>();
  for (const { a, b, e } of sectorLinks(w)) {
    if (!e.gate || !a.region || !b.region) continue;
    const key = [a.region, b.region].sort().join('|');
    const g = gates.get(key) ?? { a: a.region, b: b.region, n: 0, rift: true };
    g.n++;
    g.rift &&= !!e.rift;
    gates.set(key, g);
  }
  // Routes through unclaimed space, abstracted to region level: each connected patch of unclaimed sectors links the
  // regions it touches (joined along a minimum spanning tree of their centres), drawn faint and dashed. No sector detail.
  const links = sectorLinks(w);
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  for (const s of w.sectors.values()) if (!s.region) parent.set(s.id, s.id);
  for (const { a, b } of links) if (!a.region && !b.region) parent.set(find(a.id), find(b.id));
  const touched = new Map<string, Set<string>>();
  for (const { a, b } of links) {
    const [wild, other] = !a.region && b.region ? [a, b] : !b.region && a.region ? [b, a] : [null, null];
    if (!wild || !other?.region) continue;
    const c = find(wild.id);
    touched.set(c, (touched.get(c) ?? new Set()).add(other.region));
  }
  const through = new Set<string>();
  for (const set of touched.values()) {
    const ids = [...set].filter((id) => regions.has(id));
    const inTree = new Set(ids.slice(0, 1));
    while (inTree.size < ids.length) {
      let best: [string, string, number] | null = null;
      for (const p of inTree) {
        for (const q of ids) {
          if (inTree.has(q)) continue;
          const d = Math.hypot(regions.get(p)!.x - regions.get(q)!.x, regions.get(p)!.y - regions.get(q)!.y);
          if (!best || d < best[2]) best = [p, q, d];
        }
      }
      inTree.add(best![1]);
      const key = [best![0], best![1]].sort().join('|');
      if (!gates.has(key)) through.add(key);
    }
  }
  for (const key of through) {
    const [ia, ib] = key.split('|') as [string, string];
    const [ax, ay] = map([regions.get(ia)!.x, regions.get(ia)!.y]);
    const [bx, by] = map([regions.get(ib)!.x, regions.get(ib)!.y]);
    out.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="#94a3b8" stroke-opacity="0.45" stroke-width="1.4" stroke-dasharray="6 6"/>`);
  }
  for (const g of gates.values()) {
    const ra = regions.get(g.a);
    const rb = regions.get(g.b);
    if (!ra || !rb) continue;
    const [ax, ay] = map([ra.x, ra.y]);
    const [bx, by] = map([rb.x, rb.y]);
    out.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${g.rift ? '#a78bfa' : '#7dd3fc'}" stroke-opacity="0.7" stroke-width="${1.2 + g.n}"${g.rift ? ' stroke-dasharray="2 5"' : ''}/>`);
  }
  for (const [id, r] of regions) {
    const [x, y] = map([r.x, r.y]);
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    const s0 = r.list[0]!;
    const col = colOf(s0.faction);
    const rad = 5 + Math.sqrt(r.list.length) * 2.6;
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rad * 2).toFixed(1)}" fill="${col}" opacity="0.18" filter="url(#soft)"/>`);
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="#0b1220" stroke="${col}" stroke-width="2"/>`);
    if (id === here.region) out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rad + 6).toFixed(1)}" fill="none" stroke="#22d3ee" stroke-width="2.5"/>`);
    out.push(`<text x="${x.toFixed(1)}" y="${(y + rad + 14).toFixed(1)}" text-anchor="middle" ${font} font-size="11" letter-spacing="2" fill="${col}" stroke="#05070d" stroke-width="3" paint-order="stroke">${(s0.regionName ?? '').toUpperCase()}</text>`);
    out.push(`<text x="${x.toFixed(1)}" y="${(y + rad + 27).toFixed(1)}" text-anchor="middle" ${font} font-size="9" fill="#94a3b8" stroke="#05070d" stroke-width="3" paint-order="stroke">${REGION_TYPE[s0.regionType ?? ''] ?? ''}</text>`);
  }
  out.push(`<text x="24" y="${H - 22}" ${font} font-size="13" letter-spacing="2" fill="#94a3b8">ZOOM 3/3 (regions)  ·  lines: gates between regions (thicker = more)  ·  faint dashed: a route through unclaimed space</text>`);
  out.push('</svg>');
  return out.join('\n');
}
