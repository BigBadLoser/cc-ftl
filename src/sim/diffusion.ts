import { CHUNK_SIZE, type GridLike } from './grid';
import { ShipGrid } from './shipGrid';
import { type ChunkTiles, loadChunkInto } from './sectorGridBulk';
import { Struct, VentState, gasConductance, isAirless } from './structure';

/**
 * A region's structure as the field systems see it, rebuilt only when its `struct` revision changes. `active` lists the
 * tiles a gas link can touch: every non-Space tile plus each Space tile 4-adjacent to one. Space-to-Space links never
 * move anything, so diffusion over `active` gives exactly the result of a full sweep while vacuum inside the bbox
 * (open truss frames, the margin of a template) costs nothing.
 */
export interface FieldFrame {
  readonly width: number;
  readonly height: number;
  readonly rev: number;
  readonly struct: Float64Array;
  /** Ascending tile indices (y * width + x). */
  readonly active: Int32Array;
  /** Per-field delta scratch for diffuseStep, all zero between calls. */
  readonly scratch: Float64Array[];
}

const frames = new WeakMap<GridLike, FieldFrame>();

/** The cached frame of a grid (whole local rectangle). Read-only. */
export function fieldFrame(grid: GridLike): FieldFrame {
  const rev = grid.revision('struct');
  const hit = frames.get(grid);
  if (hit && hit.rev === rev && hit.width === grid.width && hit.height === grid.height) return hit;
  const { width, height } = grid;
  const struct = grid.load('struct');
  const list: number[] = [];
  for (let i = 0; i < struct.length; i++) {
    if (struct[i] !== Struct.Space) {
      list.push(i);
      continue;
    }
    const x = i % width;
    if (
      (x > 0 && struct[i - 1] !== Struct.Space) || (x < width - 1 && struct[i + 1] !== Struct.Space) ||
      (i >= width && struct[i - width] !== Struct.Space) || (i + width < struct.length && struct[i + width] !== Struct.Space)
    ) list.push(i);
  }
  const frame: FieldFrame = { width, height, rev, struct, active: Int32Array.from(list), scratch: [] };
  frames.set(grid, frame);
  return frame;
}

const CHUNK_SHIFT = Math.log2(CHUNK_SIZE);
const CHUNK_MASK = CHUNK_SIZE - 1;

type CondCache = { frame: FieldFrame; door: number; vent: number; cond: Float64Array; doors: Int32Array };
const conds = new WeakMap<GridLike, CondCache>();
const ventConds = new WeakMap<GridLike, CondCache>();

/**
 * Per-tile gas conductance (0 walls / closed doors, 1 floor and space, fraction for doors), filled on active tiles only.
 * Cached per grid until its `struct` frame or `door` revision changes, so the diffusion solvers of a tick share one
 * map. Only door tiles read the `door` field, so a `door` write alone refreshes just them. The result is read-only.
 * With `vents`, an open vent (`vent` field) also passes air through a shut door: only the atmosphere solver asks (a vent
 * passes air and pressure, not heat or smoke), and it has its own cache.
 */
export function conductanceMap(grid: GridLike, frame: FieldFrame, vents = false): Float64Array {
  const doorRev = grid.revision('door');
  const useVents = vents && grid.has('vent');
  const ventRev = useVents ? grid.revision('vent') : 0;
  const cache = vents ? ventConds : conds;
  const open = (x: number, y: number): boolean => useVents && grid.get('vent', x, y) === VentState.Open;
  const hit = cache.get(grid);
  if (hit && hit.frame === frame) {
    if (hit.door === doorRev && hit.vent === ventRev) return hit.cond;
    const { width, x0, y0 } = grid;
    for (const i of hit.doors) {
      const x = i % width, y = (i - x) / width;
      hit.cond[i] = gasConductance(Struct.Door, grid.get('door', x0 + x, y0 + y), open(x0 + x, y0 + y));
    }
    hit.door = doorRev;
    hit.vent = ventRev;
    return hit.cond;
  }
  const { width, x0, y0 } = grid;
  const door = grid.load('door');
  const out = new Float64Array(frame.struct.length);
  for (const i of frame.active) {
    const x = i % width, y = (i - x) / width;
    out[i] = gasConductance(frame.struct[i] as number, door[i] as number, frame.struct[i] === Struct.Door && open(x0 + x, y0 + y));
  }
  cache.set(grid, { frame, door: doorRev, vent: ventRev, cond: out, doors: tilesOf(frame, isDoor) });
  return out;
}

const isDoor = (kind: number): boolean => kind === Struct.Door;
const tileLists = new WeakMap<FieldFrame, Map<(kind: number) => boolean, Int32Array>>();

/** Ascending indices of the frame's tiles whose struct kind passes `test` (a pure test of the kind), cached per frame and test. */
export function tilesOf(frame: FieldFrame, test: (kind: number) => boolean): Int32Array {
  let byTest = tileLists.get(frame);
  if (!byTest) tileLists.set(frame, (byTest = new Map()));
  let hit = byTest.get(test);
  if (!hit) {
    const list: number[] = [];
    for (let i = 0; i < frame.struct.length; i++) if (test(frame.struct[i] as number)) list.push(i);
    byTest.set(test, (hit = Int32Array.from(list)));
  }
  return hit;
}

const buffers = new WeakMap<GridLike, Map<string, Float64Array>>();

/** A reused scratch array of the grid's area, by name (one per name and grid). Contents are whatever the last user left. */
export function scratchOf(grid: GridLike, name: string): Float64Array {
  let byName = buffers.get(grid);
  if (!byName) buffers.set(grid, (byName = new Map()));
  const n = grid.width * grid.height;
  let buf = byName.get(name);
  if (!buf || buf.length !== n) byName.set(name, (buf = new Float64Array(n)));
  return buf;
}

/** A field's values over a ship view, kept equal to the grid: the sector revision of each chunk it last matched. */
interface Mirror {
  readonly vals: Float64Array;
  readonly cx0: number;
  readonly cy0: number;
  readonly ncx: number;
  readonly revs: Float64Array;
  /** Per chunk, 1 when it must be compared in full at the next write-back: loaded since (written by someone else), or never written back. */
  readonly full: Uint8Array;
  /** The frame and tile kinds of the last `writeBackMirror` with `holds`; another frame compares every chunk in full. */
  frame: FieldFrame | null;
}

const mirrors = new WeakMap<GridLike, Map<string, Mirror>>();

function mirrorRecord(grid: ShipGrid, field: string): Mirror {
  let byField = mirrors.get(grid);
  if (!byField) mirrors.set(grid, (byField = new Map()));
  let m = byField.get(field);
  if (!m) {
    const cx0 = grid.x0 >> CHUNK_SHIFT, cy0 = grid.y0 >> CHUNK_SHIFT;
    const ncx = ((grid.x0 + grid.width - 1) >> CHUNK_SHIFT) - cx0 + 1, ncy = ((grid.y0 + grid.height - 1) >> CHUNK_SHIFT) - cy0 + 1;
    // NaN never equals a revision: the first use loads every chunk.
    m = { vals: new Float64Array(grid.width * grid.height), cx0, cy0, ncx, revs: new Float64Array(ncx * ncy).fill(NaN), full: new Uint8Array(ncx * ncy).fill(1), frame: null };
    byField.set(field, m);
  }
  return m;
}

/**
 * The values of `field` over the whole grid (what `grid.load(field)` returns), from a per-grid copy that reloads only the
 * chunks written since it last matched (chunk revisions are monotone, so an unchanged revision means unchanged tiles).
 * Read-only for the caller; `writeBackMirror` keeps it in step with its own writes. A cache, never saved.
 */
export function fieldMirror(grid: GridLike, field: string): Float64Array {
  if (!(grid instanceof ShipGrid)) {
    const out = scratchOf(grid, `mirror.${field}`);
    out.set(grid.load(field));
    return out;
  }
  const m = mirrorRecord(grid, field);
  const rect = grid.rect;
  for (let k = 0; k < m.revs.length; k++) {
    const cx = m.cx0 + (k % m.ncx), cy = m.cy0 + Math.floor(k / m.ncx);
    const rev = grid.sector.chunkRevision(field, cx, cy);
    if (rev === m.revs[k]) continue;
    loadChunkInto(grid.sector, field, rect, m.vals, cx, cy);
    m.revs[k] = rev;
    m.full[k] = 1;
  }
  return m.vals;
}

/**
 * `writeBack` against the grid's mirror of `field` (`before` must be what `fieldMirror` returned this tick, with no write to the
 * field since): the same writes, and the mirror takes the written values so it stays equal to the field.
 * `holds`: the tile kinds the solve can change. A chunk nobody else wrote since the last such write-back over the same frame
 * compares only its tiles of those kinds (the rest still hold what that write-back left; #65); any other chunk compares in full.
 */
export function writeBackMirror(grid: GridLike, field: string, vals: Float64Array, before: Float64Array, eps: number, holds?: (kind: number) => boolean): number {
  if (!(grid instanceof ShipGrid)) return writeBack(grid, field, vals, before, eps);
  const m = mirrorRecord(grid, field);
  let only: ChunkTiles | undefined;
  if (holds) {
    const frame = fieldFrame(grid);
    if (m.frame !== frame) m.full.fill(1);
    m.frame = frame;
    const lists = chunkTilesOf(grid, frame, m, holds);
    only = (cx, cy) => {
      const k = cx - m.cx0 + (cy - m.cy0) * m.ncx;
      return m.full[k] ? null : (lists[k] as Int32Array);
    };
  } else m.frame = null;
  const wrote = grid.sector.writeDelta(field, grid.rect, vals, m.vals, eps, false, true, only);
  for (let k = 0; k < m.revs.length; k++) m.revs[k] = grid.sector.chunkRevision(field, m.cx0 + (k % m.ncx), m.cy0 + Math.floor(k / m.ncx));
  m.full.fill(holds ? 0 : 1);
  return wrote;
}

const chunkLists = new WeakMap<FieldFrame, Map<(kind: number) => boolean, Int32Array[]>>();

/** Per mirror chunk, the (rect index, chunk index) pairs of the frame's tiles of the kinds `holds` accepts (ChunkTiles). */
function chunkTilesOf(grid: ShipGrid, frame: FieldFrame, m: Mirror, holds: (kind: number) => boolean): Int32Array[] {
  let byTest = chunkLists.get(frame);
  if (!byTest) chunkLists.set(frame, (byTest = new Map()));
  const hit = byTest.get(holds);
  if (hit) return hit;
  const lists: number[][] = Array.from({ length: m.revs.length }, () => []);
  const { width, x0, y0 } = grid;
  for (let i = 0; i < frame.struct.length; i++) {
    if (!holds(frame.struct[i] as number)) continue;
    const gx = x0 + (i % width), gy = y0 + Math.floor(i / width);
    (lists[(gx >> CHUNK_SHIFT) - m.cx0 + ((gy >> CHUNK_SHIFT) - m.cy0) * m.ncx] as number[]).push(i, ((gy & CHUNK_MASK) << CHUNK_SHIFT) + (gx & CHUNK_MASK));
  }
  const out = lists.map((l) => Int32Array.from(l));
  byTest.set(holds, out);
  return out;
}

/**
 * The links of a frame that can ever move anything, in sweep order: both ends gas-passable kinds (floor, door, Space,
 * ground) and not both airless. Whether a door end is open is read from the conductance map on each step.
 */
interface Links {
  readonly n: number;
  readonly i: Int32Array;
  readonly j: Int32Array;
  /** Bit 1: end i airless, bit 2: end j airless. */
  readonly air: Uint8Array;
}

const linkCache = new WeakMap<FieldFrame, Links>();

/** A kind gasConductance can give a non-zero value. */
const passable = (kind: number): boolean => kind === Struct.Floor || kind === Struct.Door || isAirless(kind);

function linksOf(frame: FieldFrame): Links {
  const hit = linkCache.get(frame);
  if (hit) return hit;
  const { width, struct, active } = frame;
  const n = struct.length;
  const li: number[] = [], lj: number[] = [], la: number[] = [];
  const add = (i: number, j: number): void => {
    const ki = struct[i] as number, kj = struct[j] as number;
    if (!passable(ki) || !passable(kj)) return;
    const si = isAirless(ki), sj = isAirless(kj);
    if (si && sj) return;
    li.push(i); lj.push(j); la.push((si ? 1 : 0) | (sj ? 2 : 0));
  };
  for (let a = 0; a < active.length; a++) {
    const i = active[a] as number;
    if (i % width < width - 1) add(i, i + 1);
    if (i + width < n) add(i, i + width);
  }
  const links: Links = { n: li.length, i: Int32Array.from(li), j: Int32Array.from(lj), air: Uint8Array.from(la) };
  linkCache.set(frame, links);
  return links;
}

/**
 * One explicit, mass-conserving diffusion step over 4-neighbour links, for several fields at once.
 * Each link moves k * (a - b) from the richer tile to the poorer one, with
 * k = (kNormal, or kVent if either end is airless: Space or rock ground) * min(conductance). Airless tiles never change
 * (they are a fixed sink/source). Stable while a tile's links sum to <= 1. Links run in ascending tile order (right,
 * then down), the same order as a full row-major sweep, so the floating-point sums are identical.
 */
export function diffuseStep(
  frame: FieldFrame, cond: Float64Array, fields: Float64Array[], kNormal: number, kVent: number, floorAtZero: boolean,
): void {
  const { struct, active } = frame;
  const n = struct.length;
  while (frame.scratch.length < fields.length) frame.scratch.push(new Float64Array(n));
  const delta = frame.scratch;
  // Only links that can move anything (precomputed per frame), in the sweep order, so every per-tile sum adds the same
  // terms in the same order as the full sweep. Fields are independent, so each runs over the links alone.
  const L = linksOf(frame);
  for (let f = 0; f < fields.length; f++) {
    const v = fields[f] as Float64Array;
    const dl = delta[f] as Float64Array;
    for (let l = 0; l < L.n; l++) {
      const i = L.i[l] as number, j = L.j[l] as number, air = L.air[l] as number;
      const c = Math.min(cond[i] as number, cond[j] as number);
      if (c <= 0) continue;
      // Airless tiles (Space and rock ground) are fixed sinks: they never take on gas or heat.
      const k = (air !== 0 ? kVent : kNormal) * c;
      const d = k * ((v[i] as number) - (v[j] as number));
      if ((air & 1) === 0) dl[i] = (dl[i] as number) - d;
      if ((air & 2) === 0) dl[j] = (dl[j] as number) + d;
    }
  }
  for (let f = 0; f < fields.length; f++) {
    const v = fields[f] as Float64Array;
    const dl = delta[f] as Float64Array;
    for (let a = 0; a < active.length; a++) {
      const i = active[a] as number;
      if (dl[i] === 0) continue;
      const next = (v[i] as number) + (dl[i] as number);
      v[i] = floorAtZero && next < 0 ? 0 : next;
      dl[i] = 0;
    }
  }
}

/**
 * Write a scratch array back to a grid field where it differs from `before` (the loaded values) by more than `eps`.
 * Returns how many tiles it wrote (0: the field is a fixed point of this solve).
 */
export function writeBack(grid: GridLike, field: string, vals: Float64Array, before: Float64Array, eps: number, round = false): number {
  if (grid instanceof ShipGrid) return grid.writeDelta(field, vals, before, eps, round);
  const { width, x0, y0 } = grid;
  let wrote = 0;
  for (let i = 0; i < vals.length; i++) {
    const v = round ? Math.min(255, Math.max(0, Math.round(vals[i] as number))) : (vals[i] as number);
    if (Math.abs(v - (before[i] as number)) > eps) {
      const x = i % width;
      grid.set(field, x0 + x, y0 + (i - x) / width, v);
      wrote++;
    }
  }
  return wrote;
}

/** Revisions of `fields` on `grid`, then `extra`: everything a solve reads, as numbers. */
export function inputKey(grid: GridLike, fields: readonly string[], extra: readonly number[] = []): number[] {
  return [...fields.map((f) => grid.revision(f)), ...extra];
}

/**
 * Steady-state skipping for a field solver. A solve is a pure function of the grid fields it reads (and of `extra` key
 * values such as a decay-tick flag). If a solve wrote nothing, the grid is exactly as it found it, so while none of those
 * fields has been written since (revisions are monotone: equal sums mean no write) the next solve would read the same
 * values and again write nothing. Skipping it is exact. Per-grid state is a cache, not sim state: a fresh grid starts cold.
 */
export class SteadyState {
  private readonly at = new WeakMap<GridLike, number[]>();

  /** True if `key` equals the input key of this grid's last solve and that solve wrote nothing. */
  quiet(grid: GridLike, key: readonly number[]): boolean {
    const k = this.at.get(grid);
    return !!k && k.length === key.length && k.every((v, i) => v === key[i]);
  }

  /** Record a finished solve that started from `key` and wrote `wrote` tiles. */
  done(grid: GridLike, key: number[], wrote: number): void {
    if (wrote === 0) this.at.set(grid, key);
    else this.at.delete(grid);
  }
}

/** Links split into four phases (horizontal pairs at even x, at odd x, vertical at even y, at odd y): no tile appears twice in a phase. */
interface PhasedLinks extends Links {
  /** Start offsets of each phase in i/j/air, plus the end. */
  readonly at: Int32Array;
}
const phaseCache = new WeakMap<FieldFrame, PhasedLinks>();

function phasesOf(frame: FieldFrame): PhasedLinks {
  const hit = phaseCache.get(frame);
  if (hit) return hit;
  const L = linksOf(frame);
  const { width } = frame;
  const phase = (l: number): number => {
    const i = L.i[l] as number, j = L.j[l] as number;
    const x = i % width;
    return j === i + 1 ? x & 1 : 2 + (((i - x) / width) & 1);
  };
  const order = Array.from({ length: L.n }, (_, l) => l).sort((p, q) => phase(p) - phase(q) || p - q);
  const at = new Int32Array(5);
  for (const l of order) at[phase(l) + 1] = (at[phase(l) + 1] as number) + 1;
  for (let p = 0; p < 4; p++) at[p + 1] = (at[p + 1] as number) + (at[p] as number);
  const out: PhasedLinks = {
    n: L.n, at,
    i: Int32Array.from(order, (l) => L.i[l] as number), j: Int32Array.from(order, (l) => L.j[l] as number), air: Uint8Array.from(order, (l) => L.air[l] as number),
  };
  phaseCache.set(frame, out);
  return out;
}

/** Phase orders, one per substep in turn: each phase leads and trails equally often, so no direction leads overall. */
const ORDERS = [[0, 1, 2, 3], [1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0], [3, 2, 1, 0], [2, 3, 0, 1], [1, 0, 3, 2], [0, 1, 2, 3]] as const;

/**
 * Pairwise in-place mixing of two fields: each phase's pairs are disjoint, so a phase updates in place with no delta buffer and no
 * second pass. `step` picks the phase order (ORDERS, in turn). With k * conductance <= 0.5 an exchange never overshoots, so values stay
 * non-negative. Mass moves only between the two ends of a pair, so it is conserved exactly apart from airless sinks.
 */
export function mixPairs(frame: FieldFrame, cond: Float64Array, a: Float64Array, b: Float64Array, kNormal: number, kVent: number, step: number): void {
  const P = phasesOf(frame);
  for (const p of ORDERS[step % ORDERS.length] as readonly number[]) {
    for (let l = P.at[p] as number, end = P.at[p + 1] as number; l < end; l++) {
      const i = P.i[l] as number, j = P.j[l] as number, air = P.air[l] as number;
      const c = Math.min(cond[i] as number, cond[j] as number);
      if (c <= 0) continue;
      const k = (air !== 0 ? kVent : kNormal) * c;
      const d1 = k * ((a[i] as number) - (a[j] as number));
      const d2 = k * ((b[i] as number) - (b[j] as number));
      if ((air & 1) === 0) { a[i] = (a[i] as number) - d1; b[i] = (b[i] as number) - d2; }
      if ((air & 2) === 0) { a[j] = (a[j] as number) + d1; b[j] = (b[j] as number) + d2; }
    }
  }
}
