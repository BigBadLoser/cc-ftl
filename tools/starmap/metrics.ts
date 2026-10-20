/**
 * Dev-only large-scale galaxy metrics (nothing in src/ imports this): regions, gates, chokepoints, route choice,
 * dead ends and voids, measured on the sector graph inside an inner disc so chunk-border effects stay out.
 */
import { galaxyGen, type EdgeData, type SectorData } from '../../src/sim';
import { content } from '../../src/content';

const CHUNK = 1280;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const cv = (a: number[]) => {
  const m = mean(a);
  return m ? Math.sqrt(mean(a.map((v) => (v - m) ** 2))) / m : 0;
};

/** Bridges of an undirected graph (iterative Tarjan); returns the edge indices that are bridges. */
function bridges(n: number, adj: [number, number][][]): Set<number> {
  const disc = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const out = new Set<number>();
  let t = 0;
  for (let root = 0; root < n; root++) {
    if (disc[root] >= 0) continue;
    const stack: { v: number; pe: number; i: number }[] = [{ v: root, pe: -1, i: 0 }];
    disc[root] = low[root] = t++;
    while (stack.length) {
      const f = stack[stack.length - 1];
      if (f.i < adj[f.v].length) {
        const [w, ei] = adj[f.v][f.i++];
        if (ei === f.pe) continue;
        if (disc[w] < 0) {
          disc[w] = low[w] = t++;
          stack.push({ v: w, pe: ei, i: 0 });
        } else low[f.v] = Math.min(low[f.v], disc[w]);
      } else {
        stack.pop();
        if (stack.length) {
          const p = stack[stack.length - 1];
          low[p.v] = Math.min(low[p.v], low[f.v]);
          if (low[f.v] > disc[p.v]) out.add(f.pe);
        }
      }
    }
  }
  return out;
}

/** Edge-disjoint path count between s and t (unit capacities, BFS augmenting), capped. */
function maxFlow(n: number, adj: [number, number][][], eu: Int32Array, ev: Int32Array, s: number, t: number, cap: number): number {
  // Undirected unit edge e: flow[e] in {-1,0,1}; direction u->v positive. Residual u->v = 1 - flow, v->u = 1 + flow.
  const flow = new Int8Array(eu.length);
  let total = 0;
  const prevV = new Int32Array(n);
  const prevE = new Int32Array(n);
  while (total < cap) {
    prevV.fill(-1);
    prevV[s] = s;
    const q = [s];
    for (let h = 0; h < q.length && prevV[t] < 0; h++) {
      const v = q[h];
      for (const [w, e] of adj[v]) {
        if (prevV[w] >= 0) continue;
        const res = eu[e] === v ? 1 - flow[e] : 1 + flow[e];
        if (res < 1) continue;
        prevV[w] = v;
        prevE[w] = e;
        q.push(w);
      }
    }
    if (prevV[t] < 0) break;
    for (let v = t; v !== s; v = prevV[v]) {
      const e = prevE[v];
      flow[e] += eu[e] === prevV[v] ? 1 : -1;
    }
    total++;
  }
  return total;
}

export function metrics(seed: number, radius: number): Record<string, number> {
  const gen = galaxyGen(seed, content.galaxy);
  const sectors = new Map<string, SectorData>();
  const hl = new Map<string, EdgeData>();
  const nodeSector = new Map<string, string>();
  for (let cy = -radius; cy <= radius; cy++) {
    for (let cx = -radius; cx <= radius; cx++) {
      const c = gen.chunk(cx, cy);
      for (const s of c.sectors) sectors.set(s.id, s);
      for (const nd of c.nodes) nodeSector.set(nd.id, nd.sector);
      for (const e of c.edges) if (e.kind === 'hyperlane') hl.set(e.id, e);
    }
  }
  const ids = [...sectors.keys()];
  const idx = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const innerR = (radius - 1) * CHUNK;
  const inner = ids.map((id) => Math.hypot(sectors.get(id)!.x, sectors.get(id)!.y) <= innerR);
  const adj: [number, number][][] = ids.map(() => []);
  const eus: number[] = [];
  const evs: number[] = [];
  for (const e of hl.values()) {
    const a = idx.get(nodeSector.get(e.a) ?? '');
    const b = idx.get(nodeSector.get(e.b) ?? '');
    if (a === undefined || b === undefined || a === b) continue;
    const k = eus.length;
    eus.push(a);
    evs.push(b);
    adj[a].push([b, k]);
    adj[b].push([a, k]);
  }
  const eu = Int32Array.from(eus);
  const ev = Int32Array.from(evs);
  const innerIdx = ids.map((_, i) => i).filter((i) => inner[i]);
  const innerSectors = innerIdx.map((i) => sectors.get(ids[i])!);
  const m: Record<string, number> = {};

  m.sectors = innerSectors.length;
  const nps = innerSectors.map((s) => s.nodes.length);
  m.nodes = nps.reduce((a, b) => a + b, 0);
  m.nodesPerSector = mean(nps);
  m.nodesPerSectorCV = cv(nps);
  m.radiusCV = cv(innerSectors.map((s) => s.r));

  // Region transitions along rays.
  let trans = 0;
  const rays = 16;
  for (let k = 0; k < rays; k++) {
    const ang = (k / rays) * Math.PI * 2;
    let last: string | null = null;
    for (let d = 0; d <= innerR; d += 100) {
      const r = gen.regions.regionAt(Math.round(Math.cos(ang) * d), Math.round(Math.sin(ang) * d));
      if (r && r.id !== last) trans++;
      if (r) last = r.id;
    }
  }
  m.regionsPer10k = (trans / (rays * innerR)) * 10000;

  // Regions by their inner sectors; gates per bordering pair (pairs joined by at least one gate lane).
  const counts = new Map<string, number>();
  for (const s of innerSectors) if (s.region) counts.set(s.region, (counts.get(s.region) ?? 0) + 1);
  m.regions = counts.size;
  m.sectorsPerRegion = mean([...counts.values()]);
  m.regionSizeCV = cv([...counts.values()]);
  m.regionless = innerSectors.length ? innerSectors.filter((s) => !s.region).length / innerSectors.length : 0;
  const pairGates = new Map<string, number>();
  const hyper = [...hl.values()].filter((e) => {
    const sa = sectors.get(nodeSector.get(e.a) ?? '');
    return !!sa && Math.hypot(sa.x, sa.y) <= innerR;
  });
  for (const e of hyper) {
    if (!e.gate) continue;
    const ra = sectors.get(nodeSector.get(e.a) ?? '')?.region;
    const rb = sectors.get(nodeSector.get(e.b) ?? '')?.region;
    if (!ra || !rb) continue;
    const key = [ra, rb].sort().join('|');
    pairGates.set(key, (pairGates.get(key) ?? 0) + 1);
  }
  m.gatesPerPair = mean([...pairGates.values()]);
  m.gateShare = hyper.length ? hyper.filter((e) => e.gate).length / hyper.length : 0;

  // Bridges, degrees, reachability.
  const br = bridges(n, adj);
  let innerLanes = 0;
  let innerBridges = 0;
  for (let k = 0; k < eu.length; k++) {
    if (!inner[eu[k]] || !inner[ev[k]]) continue;
    innerLanes++;
    if (br.has(k)) innerBridges++;
  }
  m.bridgeShare = innerLanes ? innerBridges / innerLanes : 0;
  const deg = innerIdx.map((i) => adj[i].length);
  m.deadEnds = deg.length ? deg.filter((d) => d === 1).length / deg.length : 0;
  m.isolated = deg.filter((d) => d === 0).length;
  m.meanDegree = mean(deg);
  const seen = new Uint8Array(n);
  const root = idx.get('s.0.0');
  if (root !== undefined) {
    seen[root] = 1;
    const q = [root];
    for (let h = 0; h < q.length; h++) for (const [w] of adj[q[h]]) if (!seen[w]) { seen[w] = 1; q.push(w); }
  }
  m.unreachable = innerIdx.filter((i) => !seen[i]).length;

  // Route choice: edge-disjoint paths between sector pairs 2500-3500 apart.
  let rng = (seed * 2654435761 + 12345) >>> 0;
  const rand = (k: number) => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0), rng % k);
  const flows: number[] = [];
  for (let tries = 0; flows.length < 60 && tries < 20000 && innerIdx.length > 1; tries++) {
    const a = innerIdx[rand(innerIdx.length)];
    const b = innerIdx[rand(innerIdx.length)];
    const d = Math.hypot(sectors.get(ids[a])!.x - sectors.get(ids[b])!.x, sectors.get(ids[a])!.y - sectors.get(ids[b])!.y);
    if (a !== b && d >= 2500 && d <= 3500) flows.push(maxFlow(n, adj, eu, ev, a, b, 5));
  }
  m.routeChoice = mean(flows);
  m.routeChoice1 = flows.length ? flows.filter((f) => f === 1).length / flows.length : 0;

  // Void share: grid points with no sector centre within 400.
  const cell = 400;
  const hash = new Map<string, [number, number][]>();
  for (const s of sectors.values()) {
    const key = `${Math.floor(s.x / cell)},${Math.floor(s.y / cell)}`;
    if (!hash.has(key)) hash.set(key, []);
    hash.get(key)!.push([s.x, s.y]);
  }
  let pts = 0;
  let empty = 0;
  for (let y = -innerR; y <= innerR; y += 100) {
    for (let x = -innerR; x <= innerR; x += 100) {
      if (Math.hypot(x, y) > innerR) continue;
      pts++;
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      let near = false;
      for (let j = gy - 1; j <= gy + 1 && !near; j++) {
        for (let i = gx - 1; i <= gx + 1 && !near; i++) {
          for (const [sx, sy] of hash.get(`${i},${j}`) ?? []) if (Math.hypot(sx - x, sy - y) <= cell) { near = true; break; }
        }
      }
      if (!near) empty++;
    }
  }
  m.voidShare = pts ? empty / pts : 0;

  for (const k of Object.keys(m)) m[k] = r3(m[k]);
  return m;
}
