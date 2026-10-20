/**
 * Dev-only galaxy overview (nothing in src/ imports this): generate a square of chunks straight from the generator
 * and draw sectors, hulls (tinted by territory), routes, hyperlanes, structures and danger rings as one SVG.
 */
import { galaxyGen, type ChunkData, type EdgeData, type NodeData, type SectorData } from '../../src/sim';
import { content } from '../../src/content';

export interface Overview {
  svg: string;
  stats: Record<string, number>;
}

export function overview(seed: number, radius: number, scale = 0.25): Overview {
  const gen = galaxyGen(seed, content.galaxy);
  const chunks: ChunkData[] = [];
  for (let cy = -radius; cy <= radius; cy++) for (let cx = -radius; cx <= radius; cx++) chunks.push(gen.chunk(cx, cy));
  const nodes = new Map<string, NodeData>();
  const edges = new Map<string, EdgeData>();
  for (const c of chunks) {
    for (const n of c.nodes) nodes.set(n.id, n);
    for (const e of c.edges) edges.set(e.id, e);
  }
  const span = (radius + 0.5) * 1280;
  const size = Math.ceil(span * 2 * scale);
  const X = (v: number) => ((v + span) * scale).toFixed(1);
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`, `<rect width="100%" height="100%" fill="#070b12"/>`];
  // Terrain underlay: a soft glow where space is dense, black rifts elsewhere.
  const step = 120;
  out.push('<defs><filter id="blur"><feGaussianBlur stdDeviation="6"/></filter><filter id="wash"><feGaussianBlur stdDeviation="9"/></filter></defs><g filter="url(#blur)">');
  for (let y = -span; y < span; y += step) {
    for (let x = -span; x < span; x += step) {
      const d = gen.terrain.density(x + step / 2, y + step / 2);
      if (d < 0.05) continue;
      out.push(`<rect x="${X(x)}" y="${X(y)}" width="${(step * scale + 1).toFixed(1)}" height="${(step * scale + 1).toFixed(1)}" fill="#3b5a8a" fill-opacity="${(d * 0.32).toFixed(2)}"/>`);
    }
  }
  out.push('</g>');
  for (let d = 650; d < span * 1.5; d += 650) out.push(`<circle cx="${X(0)}" cy="${X(0)}" r="${(d * scale).toFixed(1)}" fill="none" stroke="#1d2a3d" stroke-dasharray="4 6"/>`);
  for (let k = -radius; k <= radius + 1; k++) {
    const v = X((k - 0.5) * 1280 - 160);
    out.push(`<line x1="${v}" y1="0" x2="${v}" y2="${size}" stroke="#152033"/><line x1="0" y1="${v}" x2="${size}" y2="${v}" stroke="#152033"/>`);
  }
  // Territory wash: a soft blob of the owner's colour around every claimed sector.
  out.push('<g filter="url(#wash)" opacity="0.5">');
  for (const c of chunks) {
    for (const s of c.sectors) {
      if (!s.faction) continue;
      const col = content.galaxy.factions[s.faction as keyof typeof content.galaxy.factions]?.color ?? '#888';
      out.push(`<circle cx="${X(s.x)}" cy="${X(s.y)}" r="${(s.r * 2.1 * scale).toFixed(1)}" fill="${col}"/>`);
    }
  }
  out.push('</g>');
  for (const c of chunks) {
    for (const s of c.sectors) {
      const col = s.faction ? content.galaxy.factions[s.faction as keyof typeof content.galaxy.factions]?.color ?? '#888' : '#5a6b85';
      const pts = s.hull.map((p) => `${X(p.x)},${X(p.y)}`).join(' ');
      out.push(`<polygon points="${pts}" fill="${col}" fill-opacity="${s.faction ? 0.18 : 0.06}" stroke="${col}" stroke-opacity="0.7"/>`);
    }
  }
  let hyper = 0;
  let routes = 0;
  for (const e of edges.values()) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) continue;
    if (e.kind === 'hyperlane') hyper++;
    else routes++;
    out.push(e.kind === 'hyperlane'
      ? `<line x1="${X(a.x)}" y1="${X(a.y)}" x2="${X(b.x)}" y2="${X(b.y)}" stroke="${e.rift ? '#c4b5fd' : '#7dd3fc'}" stroke-opacity="${e.gate ? 0.95 : 0.5}" stroke-width="${e.gate ? 3.2 : 1.4}"${e.rift ? ' stroke-dasharray="2 5"' : e.anchor ? ' stroke-dasharray="6 3"' : ''}/>`
      : `<line x1="${X(a.x)}" y1="${X(a.y)}" x2="${X(b.x)}" y2="${X(b.y)}" stroke="#8195b3" stroke-opacity="0.5"/>`);
  }
  for (const n of nodes.values()) {
    const st = n.structures.map((s) => content.galaxy.structures[s.def as keyof typeof content.galaxy.structures]?.badge ?? '?').join('');
    const fill = st.includes('T') || st.includes('M') || st.includes('R') ? '#f8fafc' : st.includes('D') ? '#f97316' : st.includes('A') ? '#a3a3a3' : '#64748b';
    out.push(`<circle cx="${X(n.x)}" cy="${X(n.y)}" r="${(n.contacts.length ? 1.6 : 1.1) * Math.min(1, scale / 0.12 + 0.5)}" fill="${fill}"${n.contacts.length ? ' stroke="#ef4444"' : ''}/>`);
  }
  out.push(`<circle cx="${X(0)}" cy="${X(0)}" r="5" fill="none" stroke="#22d3ee" stroke-width="2"/>`);
  // Region borders: each sector's Voronoi cell (clipped to a disc around it); cell edges facing a sector of another
  // region are drawn. Solid where the owner changes, dashed between two regions of the same owner.
  const all = chunks.flatMap((c) => c.sectors);
  const CELL_R = 620;
  for (const a of all) {
    let poly: { x: number; y: number; from: SectorData | null }[] = [];
    for (let k = 0; k < 24; k++) {
      const t = (k / 24) * Math.PI * 2;
      poly.push({ x: a.x + Math.cos(t) * CELL_R, y: a.y + Math.sin(t) * CELL_R, from: null });
    }
    for (const b of all) {
      if (b === a || Math.hypot(b.x - a.x, b.y - a.y) > 2 * CELL_R) continue;
      // Keep the half-plane closer to a than to b; tag new edges with b.
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const nx = b.x - a.x;
      const ny = b.y - a.y;
      const side = (p: { x: number; y: number }) => (p.x - mx) * nx + (p.y - my) * ny;
      const next: typeof poly = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i]!;
        const q = poly[(i + 1) % poly.length]!;
        const sp = side(p);
        const sq = side(q);
        if (sp <= 0) next.push(p);
        if ((sp <= 0) !== (sq <= 0)) {
          const t = sp / (sp - sq);
          next.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, from: sp <= 0 ? b : p.from });
        }
      }
      poly = next;
    }
    // Vertex i starts the edge to i+1; `from` on the vertex after a cut names the neighbour across that edge.
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const b = p.from;
      if (!b || b.region === a.region || b.id < a.id) continue;
      const same = a.faction === b.faction;
      out.push(`<line x1="${X(p.x)}" y1="${X(p.y)}" x2="${X(q.x)}" y2="${X(q.y)}" stroke="#e2e8f0" stroke-opacity="${same ? 0.35 : 0.6}" stroke-width="1.6"${same ? ' stroke-dasharray="5 5"' : ''} stroke-linecap="round"/>`);
    }
  }
  // Region names under the sector nearest each region's centroid.
  const members = new Map<string, SectorData[]>();
  for (const s of all) if (s.region) members.set(s.region, [...(members.get(s.region) ?? []), s]);
  for (const [id, list] of members) {
    if (list.length < 3) continue;
    const cx = list.reduce((t, s) => t + s.x, 0) / list.length;
    const cy = list.reduce((t, s) => t + s.y, 0) / list.length;
    const at = list.reduce((m, s) => (Math.hypot(s.x - cx, s.y - cy) < Math.hypot(m.x - cx, m.y - cy) ? s : m));
    const [, rx, ry] = id.split('.').map(Number);
    const reg = gen.regions.region(rx as number, ry as number);
    if (!reg) continue;
    const col = reg.faction ? content.galaxy.factions[reg.faction as keyof typeof content.galaxy.factions]?.color ?? '#cbd5e1' : '#cbd5e1';
    const ty = Number(X(at.y + at.r)) + 15;
    out.push(`<text x="${X(at.x)}" y="${ty.toFixed(1)}" fill="${col}" stroke="#070b12" stroke-width="3" paint-order="stroke" font-family="Georgia,serif" font-size="14" letter-spacing="2" text-anchor="middle" style="font-variant:small-caps">${reg.name}</text>`);
  }
  out.push('</svg>');
  const sectors = chunks.reduce((t, c) => t + c.sectors.length, 0);
  return { svg: out.join('\n'), stats: { chunks: chunks.length, sectors, nodes: nodes.size, routes, hyperlanes: hyper } };
}
