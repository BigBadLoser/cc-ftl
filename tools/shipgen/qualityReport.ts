/**
 * Layout quality report (dev tool, not shipped): room quality (shipgen/rooms/quality.ts) by room role and station
 * quality (shipgen/stationQuality.ts) by spec, over seeds of every faction and station kind. The baseline to measure
 * generator changes against: compare means over the same seed range, never single seeds.
 */
import { roomQuality, stationQuality, type ModuleDef, type RoomQuality } from '../../src/sim';
import { content } from '../../src/content';
import { factionIds, gen, stationIds } from './draw';

const defs = content.modules as Record<string, ModuleDef>;
const TERMS = ['score', 'pockets', 'alignment', 'circulation', 'balance', 'density', 'openness', 'rect', 'ragged'] as const;

type Sum = Record<(typeof TERMS)[number], number> & { n: number };
export interface QualityTally {
  layouts: number;
  rooms: Sum;
  byRole: Record<string, Sum>;
  /** Rooms (corridors aside) by the layout that drew them (the topology's first word). */
  byFamily: Record<string, Sum>;
  /** Rooms (corridors aside) by shape: a rectangle (rect >= 0.95), near one (>= 0.8), or not. */
  byShape: Record<string, Sum>;
  /**
   * Per spec: room score, adjacency and clustering means; `voids`, empty space enclosed by the hull as a share of its
   * floor (the gaps between rings); `thin`, the share of rooms (corridors aside) that are far from a rectangle (rect < 0.6:
   * slivers and stretched segments).
   */
  bySpec: Record<string, { layouts: number; room: number; adjacency: number; clustering: number; voids: number; thin: number }>;
  pairs: Record<string, { sum: number; n: number }>;
  ms: number;
}

const zero = (): Sum => ({ n: 0, score: 0, pockets: 0, alignment: 0, circulation: 0, balance: 0, density: 0, openness: 0, rect: 0, ragged: 0 });
const add = (s: Sum, q: RoomQuality): void => { s.n++; for (const t of TERMS) s[t] += q[t]; };

export function qualityReport(from: number, count: number, specs = [...factionIds(), ...stationIds().map((s) => (s.startsWith('station.') ? s : `station.${s}`))]): QualityTally {
  const t: QualityTally = { layouts: 0, rooms: zero(), byRole: {}, byFamily: {}, byShape: {}, bySpec: {}, pairs: {}, ms: 0 };
  for (const spec of specs) {
    for (let seed = from; seed < from + count; seed++) {
      const t0 = performance.now();
      let g;
      try { g = gen(spec, seed, 4); } catch { continue; }
      t.ms += performance.now() - t0;
      t.layouts++;
      const roles = g.rooms.map((r) => r.role);
      const mods = (g.template.modules ?? []).map((m) => ({ ...m, rot: m.rot ?? 0 }));
      const rq = roomQuality({ rows: g.template.rows, modules: mods, roomOf: g.roomOf, defs });
      let roomSum = 0, roomN = 0, thin = 0;
      for (const q of rq) {
        const role = roles[q.room] ?? '?';
        add(t.byRole[role] ??= zero(), q);
        if (role === 'hall') continue; // corridors are walkways, not rooms to arrange
        add(t.rooms, q);
        add(t.byFamily[/\((\w+)/.exec(g.topology)?.[1] ?? g.topology.split(' ')[0] ?? '?'] ??= zero(), q);
        add(t.byShape[q.rect >= 0.95 ? 'rectangle' : q.rect >= 0.8 ? 'near' : 'irregular'] ??= zero(), q);
        roomSum += q.score; roomN++;
        if (q.rect < 0.6) thin++;
      }
      const sq = stationQuality(g.template.rows, g.roomOf, roles);
      const s = (t.bySpec[spec] ??= { layouts: 0, room: 0, adjacency: 0, clustering: 0, voids: 0, thin: 0 });
      s.layouts++; s.room += roomN > 0 ? roomSum / roomN : 0; s.adjacency += sq.adjacency; s.clustering += sq.clustering;
      s.voids += voids(g.template.rows); s.thin += roomN > 0 ? thin / roomN : 0;
      for (const [k, v] of Object.entries(sq.pairs)) { const p = (t.pairs[k] ??= { sum: 0, n: 0 }); p.sum += v; p.n++; }
    }
  }
  return t;
}

/** Empty cells the hull encloses (not reachable from the template's edge through empty space), as a share of floor. */
export function voids(rows: readonly string[]): number {
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % W, y = (i - x) / W;
    if (seen[i] || at(x, y) !== '.') continue;
    seen[i] = 1;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }
  let enclosed = 0, floor = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (c === '.' && !seen[y * W + x]) enclosed++;
    else if (c !== '.' && c !== '#') floor++;
  }
  return floor > 0 ? enclosed / floor : 0;
}
