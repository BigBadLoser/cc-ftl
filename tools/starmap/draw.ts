/**
 * Dev-only galaxy overview (nothing in src/ imports this): generate a square of chunks straight from the generator
 * and draw sectors, hulls (tinted by territory), routes, hyperlanes, structures and danger rings as one SVG.
 */
import { galaxyGen, type ChunkData, type EdgeData, type NodeData } from '../../src/sim';
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
  // Macro density underlay (void stays black) and corridor axes.
  const step = 160;
  for (let y = -span; y < span; y += step) {
    for (let x = -span; x < span; x += step) {
      const d = gen.macro.density(x + step / 2, y + step / 2);
      if (d < 0.04) continue;
      out.push(`<rect x="${X(x)}" y="${X(y)}" width="${(step * scale).toFixed(1)}" height="${(step * scale).toFixed(1)}" fill="#3b4f7a" fill-opacity="${(d * 0.45).toFixed(2)}"/>`);
    }
  }
  const corridors = new Map<string, { ax: number; ay: number; mx: number; my: number; bx: number; by: number }>();
  for (const c of gen.macro.clustersNear(0, 0, span * 1.5)) for (const k of gen.macro.corridors(c)) corridors.set(k.id, k);
  for (const k of corridors.values()) out.push(`<polyline points="${X(k.ax)},${X(k.ay)} ${X(k.mx)},${X(k.my)} ${X(k.bx)},${X(k.by)}" fill="none" stroke="#facc15" stroke-opacity="0.18" stroke-dasharray="3 5"/>`);
  for (let d = 650; d < span * 1.5; d += 650) out.push(`<circle cx="${X(0)}" cy="${X(0)}" r="${(d * scale).toFixed(1)}" fill="none" stroke="#1d2a3d" stroke-dasharray="4 6"/>`);
  for (let k = -radius; k <= radius + 1; k++) {
    const v = X((k - 0.5) * 1280 - 160);
    out.push(`<line x1="${v}" y1="0" x2="${v}" y2="${size}" stroke="#152033"/><line x1="0" y1="${v}" x2="${size}" y2="${v}" stroke="#152033"/>`);
  }
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
      ? `<line x1="${X(a.x)}" y1="${X(a.y)}" x2="${X(b.x)}" y2="${X(b.y)}" stroke="#7dd3fc" stroke-opacity="0.55" stroke-width="1.6"${e.anchor ? ' stroke-dasharray="6 3"' : ''}/>`
      : `<line x1="${X(a.x)}" y1="${X(a.y)}" x2="${X(b.x)}" y2="${X(b.y)}" stroke="#8195b3" stroke-opacity="0.5"/>`);
  }
  for (const n of nodes.values()) {
    const st = n.structures.map((s) => content.galaxy.structures[s.def as keyof typeof content.galaxy.structures]?.badge ?? '?').join('');
    const fill = st.includes('T') || st.includes('M') || st.includes('R') ? '#f8fafc' : st.includes('D') ? '#f97316' : st.includes('A') ? '#a3a3a3' : '#64748b';
    out.push(`<circle cx="${X(n.x)}" cy="${X(n.y)}" r="${n.contacts.length ? 2.6 : 1.8}" fill="${fill}"${n.contacts.length ? ' stroke="#ef4444"' : ''}/>`);
  }
  out.push(`<circle cx="${X(0)}" cy="${X(0)}" r="5" fill="none" stroke="#22d3ee" stroke-width="2"/>`);
  out.push('</svg>');
  const sectors = chunks.reduce((t, c) => t + c.sectors.length, 0);
  return { svg: out.join('\n'), stats: { chunks: chunks.length, sectors, nodes: nodes.size, routes, hyperlanes: hyper } };
}
