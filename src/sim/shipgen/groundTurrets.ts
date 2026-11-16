import { airlockTiles } from '../modules/airlock';
import { footprintTiles, rotatedSize } from '../modules/footprint';
import type { ModuleDef } from '../registry';
import type { Layout } from './layout';

/**
 * Turrets on open ground (#514): an asteroid base's guns and point defence, standing out on the levelled rock round its
 * modules (the layout's '.' tiles: the whole site is ground once the base stands), each wired to a hull wall by a cable
 * run over the ground. The asteroid base generator's choice, not a rule of the game:
 *   - a turret stands in an open pocket of ground (OPEN tiles from any hull on every side: not an alley between pods)
 *     inside the base's bounding box, else up to OUTSIDE tiles past it; its cable
 *     MIN_CABLE to MAX_CABLE tiles from the middle of a side to the nearest hull wall: straight out, at most one
 *     turn, into the wall square on (round what is in the way only where no such run reaches);
 *   - the turrets spread evenly round the base: the first nearest the command room (they are worked from its weapons
 *     console), each next one at the bearing from the base's middle furthest from those already out;
 *   - no cable runs to the arrivals hall (a room holding an airlock): visitors walk in there;
 *   - a turret keeps a ring of open ground round it (crew walk round it to repair it); it and its cable stand clear of
 *     the landing pads (and a tile round them) and of the ground before each airlock;
 *   - a module standing apart is cabled to the nearest base wall the same way (one turn at most, square on, never to or from a
 *     wall beside an airlock room), before the turrets, and not along the walk between its airlock and the base's (crew cross it);
 *   - the ground stays one open walk: every pad, every airlock's outside and every turret's ring stays reachable.
 */

export interface GroundPlan {
  /** Module defs to stand on the ground (guns, point defence), placed in this order. */
  mods: readonly string[];
  /** Boxes kept clear (the landing pads), [x0, y0, x1, y1) in layout tiles. */
  keep: readonly (readonly [number, number, number, number])[];
  /** Modules standing apart on the ground (a prefab farm's greenhouses), each as the layout's room ids: each is wired to the base before the turrets. */
  apart?: readonly (readonly number[])[];
  /** Varies the spots from base to base (the station's seed). */
  seed?: number;
}

export interface GroundFit {
  /** Indices into `lay.modules` of the turrets placed. */
  placed: number[];
  /** Cabled tiles (row-major over the layout). */
  cable: Set<number>;
}

/** Ground kept clear before an airlock's outer door, in tiles (its collar and the walk out from it). */
const APPROACH = 3;
/** A turret's cable, in tiles from its side to the hull wall: out from the base, not against it. */
const MIN_CABLE = 4, MAX_CABLE = 16;
/** Open ground a turret keeps from any hull on every side (tiles, eight ways): an open pocket, not an alley between pods. */
const OPEN = 4;
/** How far past the base's bounding box a turret may stand when the pockets inside it are too cramped. */
export const OUTSIDE = 6;

/** Place the plan's turrets on the layout's open ground and lay their cables. Turrets that find no spot are left out. */
export function placeGroundTurrets(lay: Layout, plan: GroundPlan): GroundFit {
  const { w, h } = lay;
  const out: GroundFit = { placed: [], cable: new Set() };
  const ground = (x: number, y: number): boolean => lay.at(x, y) === '.' && lay.inBounds(x, y);
  const free = (x: number, y: number): boolean => ground(x, y) && lay.occ[y * w + x] === -1 && !out.cable.has(y * w + x);
  // Kept clear: the pads and a tile round them, and the ground before each airlock.
  const clear = new Uint8Array(w * h);
  for (const [x0, y0, x1, y1] of plan.keep) for (let y = y0 - 1; y <= y1; y++) for (let x = x0 - 1; x <= x1; x++) if (lay.inBounds(x, y)) clear[y * w + x] = 1;
  const outside: { x: number; y: number }[] = [];
  for (const m of lay.modules) {
    const def = lay.defs[m.def];
    if (!def?.airlock) continue;
    const a = airlockTiles(def, m);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!ground(a.outer.x + dx, a.outer.y + dy)) continue;
      outside.push({ x: a.outer.x + dx, y: a.outer.y + dy });
      for (let k = 0; k <= APPROACH; k++) for (let s = -2; s <= 2; s++) {
        const x = a.outer.x + dx * (k + 1) + (dy !== 0 ? s : 0), y = a.outer.y + dy * (k + 1) + (dx !== 0 ? s : 0);
        if (lay.inBounds(x, y)) clear[y * w + x] = 1;
      }
    }
  }
  // The rooms visitors arrive in (those holding an airlock): no cable runs to their walls.
  const arrivals = new Set<number>();
  for (const m of lay.modules) if (lay.defs[m.def]?.airlock) for (const t of footprintTiles(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot)) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const r = lay.roomOf[(t.y + dy) * w + t.x + dx] ?? -1; if (r >= 0) arrivals.add(r); }
  }
  const besideArrivals = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const r = lay.inBounds(x + dx, y + dy) ? (lay.roomOf[(y + dy) * w + x + dx] ?? -1) : -1; if (r >= 0 && arrivals.has(r)) return true; }
    return false;
  };
  const wallAt = (x: number, y: number): boolean => lay.at(x, y) === '#' && (lay.occ[y * w + x] === -1 || !lay.defs[lay.modules[lay.occ[y * w + x] as number]!.def]?.airlock) && !besideArrivals(x, y);
  // Where the turrets gather: the command room's middle (else the middle of the floor).
  const cmd = lay.roles.map((r, i) => (r === 'bridge' ? i : -1)).filter((i) => i >= 0);
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < lay.cells.length; i++) {
    if (lay.cells[i] !== '_' || (cmd.length > 0 && !cmd.includes(lay.roomOf[i] as number))) continue;
    sx += i % w; sy += Math.floor(i / w); n++;
  }
  const cx = n ? sx / n : w / 2, cy = n ? sy / n : h / 2;
  // The base's bounding box (its hull, before any turret): the turrets tuck into the open ground inside it.
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let i = 0; i < lay.cells.length; i++) {
    if (lay.cells[i] === '.') continue;
    const x = i % w, y = Math.floor(i / w);
    bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
  }
  // Spread round the base: by the bearing from the box's middle, as evenly as the open ground allows.
  const ox = (bx0 + bx1) / 2, oy = (by0 + by1) / 2;
  const bearing = (x: number, y: number): number => Math.atan2(y - oy, x - ox);
  const gap = (a: number, b: number): number => { const d = Math.abs(a - b) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
  const open = openness();
  // A small per-base shake on each spot's score (the seed), so bases of the same plan do not all stand them alike.
  const shake = (x: number, y: number): number => { let k = (((plan.seed ?? 0) * 73856093) ^ (x * 19349663) ^ (y * 83492791)) >>> 0; k = Math.imul(k ^ (k >>> 15), 0x2c1b3c6d) >>> 0; return ((k ^ (k >>> 12)) >>> 0) / 0xffffffff; };
  wireApart();
  for (const id of plan.mods) {
    const def = lay.defs[id] as ModuleDef | undefined;
    if (!def) continue;
    const [fw, fh] = rotatedSize(def, 0);
    const reach = hullReach();
    const others = out.placed.map((k) => { const m = lay.modules[k]!, [pw, ph] = rotatedSize(lay.defs[m.def] as ModuleDef, m.rot); return { x: m.x + pw / 2, y: m.y + ph / 2 }; });
    // Inside the box first; past its edge only when nothing inside stands.
    for (const pad of [0, OUTSIDE]) {
      const spots: { x: number; y: number; score: number; run: number[] }[] = [];
      for (let y = Math.max(1, by0 + 1 - pad); y + fh <= Math.min(h - 1, by1 + pad); y++) for (let x = Math.max(1, bx0 + 1 - pad); x + fw <= Math.min(w - 1, bx1 + pad); x++) {
        const run = spot(x, y, fw, fh, reach);
        if (!run) continue;
        let room = Infinity;
        for (let ty = y; ty < y + fh; ty++) for (let tx = x; tx < x + fw; tx++) room = Math.min(room, open[ty * w + tx] as number);
        if (room < OPEN) continue;
        const mx = x + fw / 2, my = y + fh / 2;
        // The first nearest the command room; each next one at the bearing furthest from those already out (and well apart).
        const spread = others.length === 0 ? -0.3 * Math.hypot(mx - cx, my - cy)
          : 20 * Math.min(...others.map((o) => gap(bearing(mx, my), bearing(o.x, o.y)))) + 0.2 * Math.min(...others.map((o) => Math.hypot(mx - o.x, my - o.y)));
        spots.push({ x, y, run, score: spread + Math.min(room, 8) + 6 * shake(x, y) });
      }
      spots.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
      let done = false;
      for (const s of spots) {
        const run = s.run;
        if (run.some((c) => { const x = c % w, y = Math.floor(c / w); return x >= s.x && x < s.x + fw && y >= s.y && y < s.y + fh; })) continue;
        lay.push({ def: id, x: s.x, y: s.y, rot: 0 });
        for (const c of run) out.cable.add(c);
        if (opens()) { out.placed.push(lay.modules.length - 1); done = true; break; }
        for (const c of run) out.cable.delete(c);
        lay.pop();
      }
      if (done) break;
    }
  }
  return out;

  /**
   * The cable of each module standing apart: the cheapest run from a wall of its own (not beside an airlock room) to a wall of the
   * base or to a cable already laid, with at most one turn where one reaches, else any. Tiles along the walk from its airlock
   * to the nearest other airlock cost more, so the run crosses that walk rather than follows it.
   */
  function wireApart(): void {
    const mods = (plan.apart ?? []).map((ids) => new Set(ids));
    if (mods.length === 0) return;
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    const wallsOf = (rooms: Set<number>): Set<number> => {
      const out = new Set<number>();
      for (let i = 0; i < w * h; i++) {
        if (lay.cells[i] !== '_' || !rooms.has(lay.roomOf[i] as number)) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = (i % w) + dx, y = Math.floor(i / w) + dy; if (lay.at(x, y) === '#') out.add(y * w + x); }
      }
      return out;
    };
    const own = mods.map(wallsOf), theirs = new Set(own.flatMap((o) => [...o]));
    const outsideOf = (m: (typeof lay.modules)[number]): { x: number; y: number } | null => {
      const a = airlockTiles(lay.defs[m.def] as ModuleDef, m);
      return outside.find((o) => Math.abs(o.x - a.outer.x) + Math.abs(o.y - a.outer.y) === 1) ?? null;
    };
    for (const [k, rooms] of mods.entries()) {
      // The walk between this module's airlock and the nearest other one: a band along its two legs.
      const band = new Uint8Array(w * h);
      const locks = lay.modules.filter((m) => lay.defs[m.def]?.airlock).map((m) => ({ m, o: outsideOf(m), in: footprintTiles(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot).some((t) => rooms.has(lay.roomOf[t.y * w + t.x] as number)) }));
      const mine = locks.find((l) => l.in && l.o)?.o, others = locks.filter((l) => !l.in && l.o);
      const near = mine ? others.map((l) => l.o as { x: number; y: number }).sort((a, b) => Math.abs(a.x - mine.x) + Math.abs(a.y - mine.y) - Math.abs(b.x - mine.x) - Math.abs(b.y - mine.y))[0] : undefined;
      if (mine && near) {
        for (let x = Math.min(mine.x, near.x); x <= Math.max(mine.x, near.x); x++) for (let d = -1; d <= 1; d++) if (lay.inBounds(x, mine.y + d)) band[(mine.y + d) * w + x] = 1;
        for (let y = Math.min(mine.y, near.y); y <= Math.max(mine.y, near.y); y++) for (let d = -1; d <= 1; d++) if (lay.inBounds(near.x + d, y)) band[y * w + near.x + d] = 1;
      }
      const ok = (i: number): boolean => i >= 0 && i < w * h && runs(i) && !clear[i];
      const wall = (i: number): boolean => wallAt(i % w, Math.floor(i / w));
      // Done: heading square into a wall of the base, or onto a cable already laid.
      const done = (i: number, d: number): boolean => { const [dx, dy] = D4[d] as readonly [number, number], x = (i % w) + dx, y = Math.floor(i / w) + dy; return lay.inBounds(x, y) && ((wall(y * w + x) && !theirs.has(y * w + x)) || out.cable.has(y * w + x)); };
      const run = (limit: number): number[] | null => {
        // Dijkstra over (tile, heading, turns used); the heap's ties break on the state, so it is deterministic.
        const T = limit + 1, size = w * h * 4 * T, cost = new Int32Array(size).fill(1e9), from = new Int32Array(size).fill(-1), heap: [number, number][] = [];
        const push = (c: number, st: number, prev: number): void => {
          if (c >= (cost[st] as number)) return;
          cost[st] = c; from[st] = prev; heap.push([c, st]);
          for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if ((heap[p] as [number, number])[0] < (heap[i] as [number, number])[0] || ((heap[p] as [number, number])[0] === (heap[i] as [number, number])[0] && (heap[p] as [number, number])[1] <= (heap[i] as [number, number])[1])) break; [heap[p], heap[i]] = [heap[i] as [number, number], heap[p] as [number, number]]; i = p; }
        };
        const pop = (): [number, number] => {
          const top = heap[0] as [number, number], last = heap.pop() as [number, number];
          if (heap.length > 0) {
            heap[0] = last;
            for (let i = 0; ;) {
              let m = i;
              for (const c of [2 * i + 1, 2 * i + 2]) if (c < heap.length && ((heap[c] as [number, number])[0] < (heap[m] as [number, number])[0] || ((heap[c] as [number, number])[0] === (heap[m] as [number, number])[0] && (heap[c] as [number, number])[1] < (heap[m] as [number, number])[1]))) m = c;
              if (m === i) break;
              [heap[m], heap[i]] = [heap[i] as [number, number], heap[m] as [number, number]]; i = m;
            }
          }
          return top;
        };
        for (const wi of [...(own[k] as Set<number>)].sort((a, b) => a - b)) {
          if (!wall(wi)) continue;
          D4.forEach(([dx, dy], d) => { const x = (wi % w) + dx, i = (Math.floor(wi / w) + dy) * w + x; if (x >= 0 && x < w && ok(i)) push(1 + (band[i] ? 5 : 0), (i * 4 + d) * T, -1); });
        }
        while (heap.length > 0) {
          const [c, st] = pop();
          if (c > (cost[st] as number)) continue;
          const t = st % T, d = Math.floor(st / T) % 4, i = Math.floor(st / T / 4);
          if (done(i, d)) { const path: number[] = []; for (let q = st; q >= 0; q = from[q] as number) path.push(Math.floor(q / T / 4)); return path.reverse(); }
          D4.forEach(([dx, dy], nd) => {
            const x = (i % w) + dx, y = Math.floor(i / w) + dy, j = y * w + x, turn = nd !== d;
            if (x < 0 || x >= w || !ok(j) || (turn && t >= limit && limit > 0) ) return;
            push(c + 1 + (band[j] ? 5 : 0) + (turn && limit === 0 ? 1 : 0), (j * 4 + nd) * T + (turn && limit > 0 ? t + 1 : t), st);
          });
        }
        return null;
      };
      const path = run(1) ?? run(0);
      if (path) for (const i of path) out.cable.add(i);
    }
  }

  /** Whether a cable may run over a tile: open ground, nothing on it, not already cabled, not on a pad. */
  function runs(i: number): boolean {
    const x = i % w, y = Math.floor(i / w);
    return free(x, y) && !plan.keep.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
  }

  /** Each tile's open ground to the nearest hull tile, eight ways (1 beside the hull). */
  function openness(): Int32Array {
    const d = new Int32Array(w * h).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < w * h; i++) if (lay.cells[i] !== '.') { d[i] = 0; queue.push(i); }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q] as number, x = i % w, y = Math.floor(i / w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, j = ny * w + nx;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && d[j] === -1) { d[j] = (d[i] as number) + 1; queue.push(j); }
      }
    }
    for (let i = 0; i < w * h; i++) if (d[i] === -1) d[i] = 99;
    return d;
  }

  /** Each tile's cable length to a hull wall (1 beside one, four ways), over tiles a cable may run on; 0 where none reaches. */
  function hullReach(): Int32Array {
    const d = new Int32Array(w * h);
    const queue: number[] = [];
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = Math.floor(i / w);
      if (runs(i) && (wallAt(x + 1, y) || wallAt(x - 1, y) || wallAt(x, y + 1) || wallAt(x, y - 1))) { d[i] = 1; queue.push(i); }
    }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q] as number, x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && !d[j] && runs(j)) { d[j] = (d[i] as number) + 1; queue.push(j); }
    }
    return d;
  }

  /** The cable from a tile beside the turret down to the hull: each step one nearer, straight on where it can. */
  function cableFrom(from: number, reach: Int32Array): number[] {
    const run = [from];
    let i = from, dir = -1;
    while ((reach[i] as number) > 1) {
      const x = i % w, steps = [x < w - 1 ? i + 1 : -1, x > 0 ? i - 1 : -1, i + w, i - w];
      const next = steps.map((j, k) => ({ j, k })).filter(({ j }) => j >= 0 && reach[j] === (reach[i] as number) - 1);
      const pick = next.find((q) => q.k === dir) ?? next[0];
      if (!pick) break;
      i = pick.j; dir = pick.k;
      run.push(i);
    }
    return run;
  }

  /**
   * The cable for a turret at (x, y), or null when it may not stand there. The shortest run of at most one bend: out from
   * the middle of a side, then (where it must) one turn and straight into a hull wall, square on. Where no such run
   * reaches a wall, the shortest way round what is in the way (`cableFrom`).
   */
  function spot(x: number, y: number, fw: number, fh: number, reach: Int32Array): number[] | null {
    // Its footprint and a ring of ground round it: open, unclaimed, nothing built (the ring keeps it off the hull and other turrets).
    for (let ty = y - 1; ty <= y + fh; ty++) for (let tx = x - 1; tx <= x + fw; tx++) if (!free(tx, ty) || clear[ty * w + tx]) return null;
    const mx = x + Math.floor((fw - 1) / 2), my = y + Math.floor((fh - 1) / 2);
    const sides = [[mx, y - 1, 0, -1], [mx, y + fh, 0, 1], [x - 1, my, -1, 0], [x + fw, my, 1, 0]] as const;
    const ok = (tx: number, ty: number): boolean => lay.inBounds(tx, ty) && runs(ty * w + tx);
    let best: number[] | null = null;
    for (const [sx, sy, dx, dy] of sides) {
      const leg: number[] = [];
      for (let k = 0, tx = sx, ty = sy; k < MAX_CABLE && ok(tx, ty); k++, tx += dx, ty += dy) {
        leg.push(ty * w + tx);
        if (best && leg.length >= best.length) break;
        // Straight on into a wall, or a turn either way and straight into one.
        if (wallAt(tx + dx, ty + dy)) { if (leg.length >= MIN_CABLE) best = [...leg]; break; }
        for (const [ex, ey] of [[dy, dx], [-dy, -dx]] as const) {
          const run = [...leg];
          let ux = tx + ex, uy = ty + ey;
          while (run.length < MAX_CABLE && (!best || run.length < best.length) && ok(ux, uy)) {
            run.push(uy * w + ux);
            if (wallAt(ux + ex, uy + ey)) { if (run.length >= MIN_CABLE) best = run; break; }
            ux += ex; uy += ey;
          }
        }
      }
    }
    if (best) return best;
    let from = -1;
    for (const [sx, sy] of sides) {
      const i = sy * w + sx, r = reach[i] as number;
      if (r >= MIN_CABLE && r <= MAX_CABLE && (from < 0 || r < (reach[from] as number))) from = i;
    }
    return from < 0 ? null : cableFrom(from, reach);
  }

  /** True while the ground is one open walk: every airlock's outside reaches every pad and every turret's ring. */
  function opens(): boolean {
    const walk = (i: number): boolean => { const x = i % w, y = Math.floor(i / w); return ground(x, y) && lay.occ[i] === -1; };
    const start = outside.map((o) => o.y * w + o.x).filter(walk);
    if (start.length === 0) return true;
    const seen = new Uint8Array(w * h);
    const stack = [start[0] as number];
    seen[start[0] as number] = 1;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && !seen[j] && walk(j)) { seen[j] = 1; stack.push(j); }
    }
    if (start.some((i) => !seen[i])) return false;
    for (const [x0, y0, x1, y1] of plan.keep) if (!seen[Math.floor((y0 + y1) / 2) * w + Math.floor((x0 + x1) / 2)]) return false;
    for (const k of out.placed.concat([lay.modules.length - 1])) {
      const m = lay.modules[k]!;
      const tiles = footprintTiles(lay.defs[m.def] as ModuleDef, m.x, m.y, m.rot);
      const near = tiles.some((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const j = (t.y + (dy as number)) * w + t.x + (dx as number); return seen[j] === 1; }));
      if (!near) return false;
    }
    return true;
  }
}
