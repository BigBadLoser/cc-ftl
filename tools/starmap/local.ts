/**
 * Dev-only play-zoom preview (nothing in src/ imports this): one sector and its hyperlane neighbours, drawn the way the
 * starmap mockup looks (fluid sector borders, beacon icons, labelled neighbours), straight from the generator.
 */
import { galaxyGen, type EdgeData, type NodeData, type SectorData } from '../../src/sim';
import { content } from '../../src/content';

type P = [number, number];
const W = 1280;
const H = 800;
const factions = content.galaxy.factions as Record<string, { name: string; color: string } | undefined>;
const structures = content.galaxy.structures as Record<string, { kind: string } | undefined>;

/** Soft field around a sector's nodes and routes, contoured with marching squares into closed loops (an SVG path). */
function fluidBorder(nodes: P[], links: [P, P][], sig: number, step: number, map: (p: P) => P): string {
  const thr = 0.42;
  const xs = nodes.map((p) => p[0]);
  const ys = nodes.map((p) => p[1]);
  const pad = sig * 3;
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  const nx = Math.ceil((Math.max(...xs) + pad - x0) / step);
  const ny = Math.ceil((Math.max(...ys) + pad - y0) / step);
  const segd = (px: number, py: number, a: P, b: P) => {
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy || 1)));
    return Math.hypot(px - a[0] - t * vx, py - a[1] - t * vy);
  };
  const F: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * step;
      const y = y0 + j * step;
      let f = 0;
      for (const p of nodes) f += Math.exp(-((Math.hypot(x - p[0], y - p[1]) / (sig * 1.25)) ** 2));
      for (const [a, b] of links) f += 0.8 * Math.exp(-((segd(x, y, a, b) / sig) ** 2));
      row.push(f);
    }
    F.push(row);
  }
  const segs: [P, P][] = [];
  const lerp = (a: number, b: number, va: number, vb: number) => a + ((thr - va) / (vb - va)) * (b - a);
  const table: Record<number, [number, number][]> = {
    1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]],
    8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]],
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = [F[j]![i]!, F[j]![i + 1]!, F[j + 1]![i + 1]!, F[j + 1]![i]!];
      const X = x0 + i * step;
      const Y = y0 + j * step;
      const e: P[] = [
        [lerp(X, X + step, v[0]!, v[1]!), Y], [X + step, lerp(Y, Y + step, v[1]!, v[2]!)],
        [lerp(X, X + step, v[3]!, v[2]!), Y + step], [X, lerp(Y, Y + step, v[0]!, v[3]!)],
      ];
      const c = (v[0]! > thr ? 1 : 0) | (v[1]! > thr ? 2 : 0) | (v[2]! > thr ? 4 : 0) | (v[3]! > thr ? 8 : 0);
      for (const [a, b] of table[c] ?? []) segs.push([e[a]!, e[b]!]);
    }
  }
  const key = (p: P) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const adj = new Map<string, number[]>();
  segs.forEach((sg, k) => {
    for (const p of sg) adj.set(key(p), [...(adj.get(key(p)) ?? []), k]);
  });
  const used = new Set<number>();
  let d = '';
  for (let k = 0; k < segs.length; k++) {
    if (used.has(k)) continue;
    used.add(k);
    const loop: P[] = [segs[k]![0], segs[k]![1]];
    let cur = segs[k]![1];
    for (;;) {
      const nxt = (adj.get(key(cur)) ?? []).find((m) => !used.has(m));
      if (nxt === undefined) break;
      used.add(nxt);
      const sg = segs[nxt]!;
      cur = key(sg[0]) === key(cur) ? sg[1] : sg[0];
      loop.push(cur);
    }
    d += 'M' + loop.map((p) => map(p).map((v) => v.toFixed(1)).join(' ')).join(' L') + 'Z';
  }
  return d;
}

export function localView(seed: number, sectorId = 's.0.0'): { svg: string; stats: Record<string, number | string> } {
  const gen = galaxyGen(seed, content.galaxy);
  const sectors = new Map<string, SectorData>();
  const nodes = new Map<string, NodeData>();
  const edges = new Map<string, EdgeData>();
  for (let cy = -2; cy <= 2; cy++) {
    for (let cx = -2; cx <= 2; cx++) {
      const c = gen.chunk(cx, cy);
      for (const s of c.sectors) sectors.set(s.id, s);
      for (const n of c.nodes) nodes.set(n.id, n);
      for (const e of c.edges) edges.set(e.id, e);
    }
  }
  const here = sectors.get(sectorId);
  if (!here) throw new Error(`no sector ${sectorId}`);
  const lanes = [...edges.values()].filter((e) => e.kind === 'hyperlane' && (nodes.get(e.a)?.sector === here.id || nodes.get(e.b)?.sector === here.id));
  const nearIds = new Set([here.id, ...lanes.flatMap((e) => [nodes.get(e.a)?.sector ?? '', nodes.get(e.b)?.sector ?? ''])]);
    // Default zoom: centred on your sector, which fills most of the screen height; neighbours are exits at the edges.
  const k = (H * 0.62) / (2 * here.r + 60);
  const ox = W / 2 - here.x * k;
  const oy = H / 2 - here.y * k;
  const map = (p: P): P => [p[0] * k + ox, p[1] * k + oy];
  const inView = [...sectors.values()].filter((s) => {
    const [x, y] = map([s.x, s.y]);
    return x > -60 && x < W + 60 && y > -60 && y < H + 60;
  });
  const role = (s: SectorData) => (s.id === here.id ? 'here' : nearIds.has(s.id) ? 'near' : 'far');
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`];
  out.push(`<rect width="${W}" height="${H}" fill="#05070d"/>`);
  let s0 = seed * 7919 + 1;
  const rnd = () => ((s0 = (s0 * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 260; i++) out.push(`<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(rnd() * 0.9 + 0.2).toFixed(2)}" fill="#fff" opacity="${(rnd() * 0.4 + 0.1).toFixed(2)}"/>`);
  const ids = new Set(inView.map((s) => s.id));
  const sectorOf = (id: string) => nodes.get(id)?.sector ?? '';
  // Borders.
  for (const s of inView) {
    const r = role(s);
    const col = s.faction ? factions[s.faction]?.color ?? '#94a3b8' : '#94a3b8';
    const pts = s.nodes.map((id) => nodes.get(id)).filter((n): n is NodeData => !!n).map((n): P => [n.x, n.y]);
    const links = [...edges.values()].filter((e) => e.kind === 'route' && sectorOf(e.a) === s.id)
      .map((e): [P, P] => [[nodes.get(e.a)!.x, nodes.get(e.a)!.y], [nodes.get(e.b)!.x, nodes.get(e.b)!.y]]);
    const [fo, so] = r === 'here' ? [0.12, 0.85] : r === 'near' ? [0.06, 0.5] : [0.025, 0.22];
    const d = fluidBorder(pts, links, 44, 5, map);
    out.push(`<path d="${d}" fill="${col}" fill-opacity="${fo}" stroke="${col}" stroke-opacity="${so}" stroke-width="${r === 'here' ? 2 : 1.4}" fill-rule="evenodd"/>`);
  }
  // Lanes: routes inside sectors, hyperlanes between them.
  for (const e of edges.values()) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b || (!ids.has(a.sector) && !ids.has(b.sector))) continue;
    const [ax, ay] = map([a.x, a.y]);
    const [bx, by] = map([b.x, b.y]);
    if (e.kind === 'route') {
      const r = role(sectors.get(a.sector)!);
      out.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="#94a3b8" stroke-opacity="${r === 'here' ? 0.6 : r === 'near' ? 0.35 : 0.15}" stroke-width="${r === 'here' ? 1.6 : 1.1}"/>`);
    } else {
      const mine = a.sector === here.id || b.sector === here.id;
      const col = e.rift ? '#a78bfa' : mine ? '#7dd3fc' : '#475569';
      out.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${col}" stroke-opacity="${mine ? 0.85 : 0.5}" stroke-width="${mine ? 3 : 2}"${e.rift ? ' stroke-dasharray="3 6"' : ''}/>`);
    }
  }
  // Beacons.
  for (const s of inView) {
    const r = role(s);
    const stroke = r === 'here' ? '#e2e8f0' : r === 'near' ? '#94a3b8' : '#475569';
    const rad = r === 'here' ? 6 : 4.5;
    for (const id of s.nodes) {
      const n = nodes.get(id);
      if (!n) continue;
      const [x, y] = map([n.x, n.y]);
      const kinds = n.structures.map((t) => structures[t.def]?.kind);
      if (kinds.includes('station')) {
        out.push(`<rect x="${(x - 5).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="10" height="10" fill="#0b1220" stroke="#f8fafc" stroke-width="1.8" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})" opacity="${r === 'far' ? 0.4 : 1}"/>`);
      } else {
        out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="#0b1220" stroke="${kinds.includes('derelict') ? '#f97316' : stroke}" stroke-width="1.5" opacity="${r === 'far' ? 0.5 : 1}"/>`);
      }
      if (r === 'here' && n.contacts.length) out.push(`<path d="M${(x - 4).toFixed(1)} ${(y - 9).toFixed(1)} l4 -7 l4 7z" fill="#ef4444"/>`);
    }
    const [lx0, ly0] = map([s.x, s.y - s.r]);
    // Keep neighbour labels on screen (pinned to the edge nearest the sector).
    const lx = Math.max(90, Math.min(W - 90, lx0));
    const ly = Math.max(30, Math.min(H - 24, ly0));
    const fac = s.faction ? factions[s.faction]?.name ?? s.faction : 'unclaimed';
    const label = r === 'here' ? '#22d3ee' : r === 'near' ? '#cbd5e1' : '#64748b';
    out.push(`<text x="${lx.toFixed(1)}" y="${(ly - 14).toFixed(1)}" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="${r === 'here' ? 15 : 13}" letter-spacing="3" fill="${label}">${s.name.toUpperCase()}</text>`);
    if (r !== 'far') out.push(`<text x="${lx.toFixed(1)}" y="${(ly + 2).toFixed(1)}" text-anchor="middle" font-family="Trebuchet MS,sans-serif" font-size="11" letter-spacing="1" fill="#64748b">${fac} · danger ${s.danger} · ${s.layout ?? ''}${s.hub ? ' (hub)' : ''}</text>`);
  }
  // Exit labels where a lane from your sector leaves the screen (its neighbour is off-screen).
  for (const e of lanes) {
    const a = nodes.get(e.a)!;
    const b = nodes.get(e.b)!;
    const [inner, outer] = a.sector === here.id ? [a, b] : [b, a];
    const [ix, iy] = map([inner.x, inner.y]);
    const [ex, ey] = map([outer.x, outer.y]);
    if (ex > 0 && ex < W && ey > 0 && ey < H) continue;
    const t = Math.min(...[(0 + 24 - ix) / (ex - ix), (W - 24 - ix) / (ex - ix), (0 + 24 - iy) / (ey - iy), (H - 24 - iy) / (ey - iy)].filter((v) => v > 0));
    const x = ix + (ex - ix) * t;
    const y = iy + (ey - iy) * t;
    const n = sectors.get(outer.sector)!;
    const fac = n.faction ? factions[n.faction]?.name ?? n.faction : 'unclaimed';
    const anchor = x > W - 200 ? 'end' : x < 200 ? 'start' : 'middle';
    const ty = y < 60 ? y + 22 : y - 22;
    out.push(`<text x="${x.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" font-family="Trebuchet MS,sans-serif" font-size="13" letter-spacing="2" fill="#e2e8f0">→ ${n.name.toUpperCase()}</text>`);
    out.push(`<text x="${x.toFixed(1)}" y="${(ty + 15).toFixed(1)}" text-anchor="${anchor}" font-family="Trebuchet MS,sans-serif" font-size="11" fill="#64748b">${fac} · danger ${n.danger}${e.rift ? ' · rift' : ''}</text>`);
  }
  const start = nodes.get(`${here.id}.n0`);
  if (start) {
    const [x, y] = map([start.x, start.y]);
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="none" stroke="#22d3ee" stroke-width="2.5"/>`);
  }
  out.push('</svg>');
  return { svg: out.join('\n'), stats: { sector: here.id, nodes: here.nodes.length, neighbours: nearIds.size - 1, scale: +k.toFixed(3) } };
}
