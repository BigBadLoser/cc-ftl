import { CHUNK_SIZE, type GridLike } from './grid';
import { ShipGrid } from './shipGrid';
import { Struct, gasConductance, isAirless } from './structure';

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

const conds = new WeakMap<GridLike, { frame: FieldFrame; door: number; cond: Float64Array; doors: Int32Array }>();

/**
 * Per-tile gas conductance (0 walls / closed doors, 1 floor and space, fraction for doors), filled on active tiles only.
 * Cached per grid until its `struct` frame or `door` revision changes, so the three diffusion solvers of a tick share one
 * map. Only door tiles read the `door` field, so a `door` write alone refreshes just them. The result is read-only.
 */
export function conductanceMap(grid: GridLike, frame: FieldFrame): Float64Array {
  const doorRev = grid.revision('door');
  const hit = conds.get(grid);
  if (hit && hit.frame === frame) {
    if (hit.door === doorRev) return hit.cond;
    const { width, x0, y0 } = grid;
    for (const i of hit.doors) {
      const x = i % width;
      hit.cond[i] = gasConductance(Struct.Door, grid.get('door', x0 + x, y0 + (i - x) / width));
    }
    hit.door = doorRev;
    return hit.cond;
  }
  const door = grid.load('door');
  const out = new Float64Array(frame.struct.length);
  for (const i of frame.active) out[i] = gasConductance(frame.struct[i] as number, door[i] as number);
  conds.set(grid, { frame, door: doorRev, cond: out, doors: tilesOf(frame, isDoor) });
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
    m = { vals: new Float64Array(grid.width * grid.height), cx0, cy0, ncx, revs: new Float64Array(ncx * ncy).fill(NaN) };
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
    grid.sector.loadChunkInto(field, rect, m.vals, cx, cy);
    m.revs[k] = rev;
  }
  return m.vals;
}

/**
 * `writeBack` against the grid's mirror of `field` (`before` must be what `fieldMirror` returned this tick, with no write to the
 * field since): the same writes, and the mirror takes the written values so it stays equal to the field.
 */
export function writeBackMirror(grid: GridLike, field: string, vals: Float64Array, before: Float64Array, eps: number): number {
  if (!(grid instanceof ShipGrid)) return writeBack(grid, field, vals, before, eps);
  const m = mirrorRecord(grid, field);
  const wrote = grid.sector.writeDelta(field, grid.rect, vals, m.vals, eps, false, true);
  for (let k = 0; k < m.revs.length; k++) m.revs[k] = grid.sector.chunkRevision(field, m.cx0 + (k % m.ncx), m.cy0 + Math.floor(k / m.ncx));
  return wrote;
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
  if (fields.length === 2) {
    linkPair(L, cond, fields[0] as Float64Array, fields[1] as Float64Array, delta[0] as Float64Array, delta[1] as Float64Array, kNormal, kVent);
  } else for (let f = 0; f < fields.length; f++) {
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

/** The link pass of diffuseStep for two fields at once (O2 and CO2 share every link): the same terms, the same order. */
function linkPair(
  L: Links, cond: Float64Array, a: Float64Array, b: Float64Array, da: Float64Array, db: Float64Array, kNormal: number, kVent: number,
): void {
  for (let l = 0; l < L.n; l++) {
    const i = L.i[l] as number, j = L.j[l] as number, air = L.air[l] as number;
    const c = Math.min(cond[i] as number, cond[j] as number);
    if (c <= 0) continue;
    const k = (air !== 0 ? kVent : kNormal) * c;
    const d1 = k * ((a[i] as number) - (a[j] as number));
    const d2 = k * ((b[i] as number) - (b[j] as number));
    if ((air & 1) === 0) {
      da[i] = (da[i] as number) - d1;
      db[i] = (db[i] as number) - d2;
    }
    if ((air & 2) === 0) {
      da[j] = (da[j] as number) + d1;
      db[j] = (db[j] as number) + d2;
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
