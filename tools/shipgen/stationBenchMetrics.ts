/**
 * Station bench: every metric of ONE generated station (hard checks, structure, circulation, room quality, signature).
 * Reads only the public GenResult and its template, so it runs unchanged on any branch with the same draw.ts helpers.
 */
import { content } from '../../src/content';
import { airlockTiles, checkUse, footprintTiles, openTilesOf, roomQuality, type GenResult, type ModuleDef } from '../../src/sim';
import { audit } from './audit';
import { ROLE_TINT } from './draw';
import { classifyVoids } from './stationBenchVoids';
import { protrusionShare } from './stationBenchHull';
import { withinExpect } from './stationBenchExpect';

const defs = content.modules as Record<string, ModuleDef>;

/** Rooms that must be rectangles (a module wants a clean box there). */
/** Cargo is reported (cargoRect) but not a hard check: every trading cargo room (market stalls) is ragged on the #234 generator. */
export const RECT_ROLES: readonly string[] = ['reactor', 'shields', 'core', 'weapons', 'hangar'];
/** Roles not counted as "rooms" for shape metrics: corridors (halls). */
const NOT_ROOM = new Set(['hall']);
const ROLE_LIST = Object.keys(ROLE_TINT);

export interface Metrics {
  hard: { reach: boolean; unreached: number; usable: boolean; useIssues: number; docks: number; docksOk: boolean; power: boolean; rects: boolean; badRects: string[] };
  /** Enclosed space as a share of floor: unintended (ragged leftovers) and deliberate (negative space), and how it was told apart. */
  voidUnintended: number;
  voidDeliberate: number;
  voidMethod: string;
  /** Regions a `negativeSpace` mask claimed deliberate that failed the geometric test. */
  maskRejected: number;
  rooms: number;
  /** Share of cargo rooms that are rectangles (NaN: none). Informational. */
  cargoRect: number;
  slivers: number;
  aspects: number[];
  fills: number[];
  protrusion: number;
  /** Walk depth (tiles from the nearest airlock) per room role. */
  depth: Record<string, number[]>;
  viaQuarters: number;
  quality: number[];
  /** Per role: [rooms within ROOM_EXPECT, rooms]. */
  expect: Record<string, [number, number]>;
  /** 16x16 role signature, one char a cell. */
  sig: string;
  /** 16x16 structure-only signature (floor / corridor / wall / space), roles ignored. */
  sigS: string;
  faces: Record<'N' | 'S' | 'E' | 'W', number>;
  /** Structural parameters of the layout (parsed from the topology string, or the result's own `params`). */
  params: Record<string, string | number>;
  /** Design violations (not functional): slivers, non-rectangular machine rooms. */
  design: string[];
}

const FACE = (x: number, y: number): 'N' | 'S' | 'E' | 'W' => (y < 0 ? 'N' : y > 0 ? 'S' : x > 0 ? 'E' : 'W');

function signature(g: GenResult, structural = false): string {
  const N = 16;
  const W = g.width, H = g.height;
  let s = '';
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
    const votes = new Map<string, number>();
    for (let y = Math.floor((cy * H) / N); y < Math.floor(((cy + 1) * H) / N); y++) for (let x = Math.floor((cx * W) / N); x < Math.floor(((cx + 1) * W) / N); x++) {
      const room = g.roomOf[y * W + x] ?? -1;
      const c = g.template.rows[y]?.[x] ?? '.';
      const k = structural ? (c === '_' || c === 'D' ? (g.rooms[room]?.role === 'hall' ? 'c' : 'f') : c === '.' ? '.' : '#') : room >= 0 ? String.fromCharCode(97 + Math.max(0, ROLE_LIST.indexOf(g.rooms[room]?.role ?? 'hall'))) : '.';
      votes.set(k, (votes.get(k) ?? 0) + 1);
    }
    s += [...votes.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? '.';
  }
  return s;
}

/** Thickness of a room: median over its tiles of min(horizontal run, vertical run) of same-room tiles through the tile. */
function thickness(tiles: number[], roomOf: Int16Array, W: number, H: number, id: number): number {
  const same = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && roomOf[y * W + x] === id;
  const ts = tiles.map((i) => {
    const x = i % W, y = Math.floor(i / W);
    let a = x, b = x, c = y, d = y;
    while (same(a - 1, y)) a--;
    while (same(b + 1, y)) b++;
    while (same(x, c - 1)) c--;
    while (same(x, d + 1)) d++;
    return Math.min(b - a + 1, d - c + 1);
  }).sort((p, q) => p - q);
  return ts[Math.floor(ts.length / 2)] ?? 0;
}

export function measure(g: GenResult): Metrics {
  const W = g.width, H = g.height;
  const rows = g.template.rows;
  const mods = (g.template.modules ?? []).map((m) => ({ ...m, rot: m.rot ?? 0 }));
  const cell = (x: number, y: number): string => (x < 0 || y < 0 || x >= W || y >= H ? '.' : (rows[y]?.[x] ?? '.'));

  // Blocking tiles (solid module tiles that are not open) and airlock entry tiles.
  const blocked = new Uint8Array(W * H);
  let supply = 0, demand = 0, docks = 0;
  const faces = { N: 0, S: 0, E: 0, W: 0 };
  const starts: number[] = [];
  for (const m of mods) {
    const d = defs[m.def];
    if (!d) continue;
    if (d.power > 0) supply += d.power; else demand -= d.power;
    if (d.solid) {
      const open = openTilesOf(d, m.x, m.y, m.rot);
      for (const t of footprintTiles(d, m.x, m.y, m.rot)) if (!open.some((o) => o.x === t.x && o.y === t.y) && t.x >= 0 && t.y >= 0 && t.x < W && t.y < H) blocked[t.y * W + t.x] = 1;
    }
    if (d.airlock) {
      docks++;
      const a = airlockTiles(d, m);
      faces[FACE(Math.sign(a.outer.x - a.inner.x), Math.sign(a.outer.y - a.inner.y))]++;
      for (const t of [a.inside, a.inner]) if (cell(t.x, t.y) === '_' || cell(t.x, t.y) === 'D') starts.push(t.y * W + t.x);
    }
  }
  // BFS walk depth from the airlocks.
  const dist = new Int32Array(W * H).fill(-1);
  const queue: number[] = [];
  for (const s of starts) if (!blocked[s] && dist[s] < 0) { dist[s] = 0; queue.push(s); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q] as number;
    const x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const c = cell(nx, ny);
      if ((c !== '_' && c !== 'D') || blocked[ny * W + nx] || dist[ny * W + nx] !== -1) continue;
      dist[ny * W + nx] = (dist[i] as number) + 1;
      queue.push(ny * W + nx);
    }
  }

  const real = g.rooms.filter((r) => !NOT_ROOM.has(r.role) && r.tiles.length > 0);
  const depth: Record<string, number[]> = {};
  let unreached = 0;
  const badRects: string[] = [];
  const aspects: number[] = [], fills: number[] = [];
  const expect: Record<string, [number, number]> = {};
  let slivers = 0;
  const cargoRect: boolean[] = [];
  const rq = new Map(roomQuality({ rows, modules: mods, roomOf: g.roomOf, defs }).map((q) => [q.room, q]));
  const footprintIn = new Map<number, number>();
  for (const m of mods) {
    const d = defs[m.def];
    if (!d || m.def.startsWith('module.light')) continue;
    for (const t of footprintTiles(d, m.x, m.y, m.rot)) {
      if (t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) continue;
      const r = g.roomOf[t.y * W + t.x] ?? -1;
      if (r >= 0) footprintIn.set(r, (footprintIn.get(r) ?? 0) + 1);
    }
  }
  for (const r of real) {
    const xs = r.tiles.map((i) => i % W), ys = r.tiles.map((i) => Math.floor(i / W));
    const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
    const aspect = Math.max(bw, bh) / Math.min(bw, bh);
    const fill = r.tiles.length / (bw * bh);
    aspects.push(aspect); fills.push(fill);
    if (RECT_ROLES.includes(r.role) && fill < 1) badRects.push(`${r.role}#${r.id}`);
    if (r.role === 'cargo') cargoRect.push(fill >= 1);
    const th = thickness(r.tiles, g.roomOf, W, H, r.id);
    if (th < 3 && r.role !== 'dock') slivers++;
    const ds = r.tiles.map((i) => dist[i] as number).filter((v) => v >= 0);
    if (ds.length === 0) { unreached++; } else (depth[r.role] ??= []).push(Math.min(...ds));
    const e = (expect[r.role] ??= [0, 0]);
    e[1]++;
    if (withinExpect(r.role, (footprintIn.get(r.id) ?? 0) / r.tiles.length, aspect, th)) e[0]++;
  }

  // Use checks only count rooms the walk reached; checkUse already skips unreachable ones.
  const use = checkUse(rows, mods, defs, g.roomOf);

  // Protrusions against the actual hull (stationBenchHull.ts); airlock footprints do not count as hull.
  const skip = new Set<number>();
  for (const m of mods) {
    const d = defs[m.def];
    if (d?.airlock) for (const t of footprintTiles(d, m.x, m.y, m.rot)) skip.add(t.y * W + t.x);
  }
  const protrusion = protrusionShare(W, H, rows, skip, real.filter((r) => r.role !== 'dock').flatMap((r) => r.tiles));

  const floorCount = rows.reduce((t, r) => t + r.split('').filter((c) => c === '_' || c === 'D').length, 0);
  return {
    hard: { reach: unreached === 0 && starts.length > 0, unreached, usable: use.length === 0, useIssues: use.length, docks, docksOk: docks >= 1, power: supply >= demand, rects: badRects.length === 0, badRects },
    ...classifyVoids(g, floorCount),
    rooms: real.length,
    cargoRect: cargoRect.length ? cargoRect.filter(Boolean).length / cargoRect.length : NaN,
    slivers, aspects, fills, protrusion, depth,
    viaQuarters: audit(g).viaQuarters.length,
    quality: real.map((r) => rq.get(r.id)?.score).filter((v): v is number => v !== undefined),
    expect, params: paramsOf(g, faces), design: [...(slivers ? [`slivers`] : []), ...[...new Set(badRects.map((b) => b.split('#')[0]))].map((r) => `non-rect machine room: ${r}`)], sig: signature(g), sigS: signature(g, true), faces,
  };
}

/** Structural parameters: the old generator's topology string ("stationWheel spokes nesw courts 2 atrium"), or `params`. */
function paramsOf(g: GenResult, faces: Record<string, number>): Record<string, string | number> {
  const t = g.topology;
  const own = (g as unknown as { params?: unknown }).params;
  const p: Record<string, string | number> = {
    layout: t.split(' ')[0] ?? '?',
    centre: (t.match(/\b(rotunda|filled|hub|open|plaza)\b/g) ?? ['none']).join('+'),
    atrium: /atrium/.test(t) ? 'yes' : 'no',
    courts: Number(/courts (\d+)/.exec(t)?.[1] ?? 0),
    spokes: /spokes (\w+)/.exec(t)?.[1] ?? '-',
    rings: /rings? (\d+)/.exec(t)?.[1] ?? '-',
    docks: Object.entries(faces).filter(([, n]) => n > 0).map(([k, n]) => `${k}${n}`).join(''),
  };
  if (own && typeof own === 'object') for (const [k, v] of Object.entries(own)) if (typeof v === 'string' || typeof v === 'number') p[`p.${k}`] = v;
  return p;
}
