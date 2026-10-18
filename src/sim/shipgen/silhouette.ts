import type { Rng } from '../rng';
import { Canvas, chunkWidth, doorCols, doorRows, flipRows } from './canvas';
import type { ChunkDef, FactionDef, Scaled, Weighted } from './types';

/** min(max, floor(base + perDepth * depth)). */
export const scaled = (s: Scaled, depth: number): number => Math.min(s.max, Math.floor(s.base + s.perDepth * depth));

export function pickWeighted<T>(rng: Rng, items: readonly Weighted<T>[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng.next() * total;
  for (const i of items) {
    r -= i.weight;
    if (r < 0) return i.value;
  }
  return (items[items.length - 1] as Weighted<T>).value;
}

const pickChunk = (rng: Rng, chunks: readonly ChunkDef[]): ChunkDef =>
  pickWeighted(rng, chunks.map((c) => ({ value: c, weight: c.weight ?? 1 })));

/** A placed pod: which side, its order along the side, and its frame on the canvas. */
export interface PodPlacement {
  side: 'n' | 's';
  index: number;
  chunk: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Silhouette {
  canvas: Canvas;
  pods: PodPlacement[];
  corridorWidth: number;
}

/** Stamp a pod (north side: bottom row on the corridor's north wall; south: flipped, top row on the south wall). */
function placePod(cv: Canvas, c: ChunkDef, side: 'n' | 's', x: number, wallY: number, key: string): PodPlacement | null {
  const rows = side === 'n' ? c.rows : flipRows(c.rows);
  const h = rows.length;
  const y = side === 'n' ? wallY - (h - 1) : wallY;
  if (!cv.stamp(rows, x, y, key)) return null;
  return { side, index: 0, chunk: key, x, y, w: chunkWidth(c), h };
}

/** Bolt a nub onto the outer wall of a pod, its door over the pod's floor. */
function addNub(cv: Canvas, rng: Rng, f: FactionDef, pod: PodPlacement, key: string): void {
  const nub = pickChunk(rng, f.chunks.nubs);
  const rows = pod.side === 'n' ? nub.rows : flipRows(nub.rows);
  const nw = chunkWidth(nub);
  const doors = doorCols(nub);
  if (doors.length === 0) return;
  const outerY = pod.side === 'n' ? pod.y : pod.y + pod.h - 1;
  const ny = pod.side === 'n' ? outerY - (rows.length - 1) : outerY;
  const inward = pod.side === 'n' ? 1 : -1;
  // Try offsets from the pod's west wall, overhanging by up to two tiles either way, in a random order.
  const offsets: number[] = [];
  for (let dx = -2; dx <= pod.w - nw + 2; dx++) offsets.push(dx);
  for (let i = offsets.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [offsets[i], offsets[j]] = [offsets[j] as number, offsets[i] as number];
  }
  for (const dx of offsets) {
    const nx = pod.x + dx;
    const ok = doors.every((d) => cv.at(nx + d, outerY) === '#' && cv.at(nx + d, outerY + inward) === '_');
    if (ok && cv.stamp(rows, nx, ny, key)) return;
  }
}

/** Pick the pods of one side. */
function podRun(rng: Rng, f: FactionDef, count: number): ChunkDef[] {
  if (f.hull.repeatPods) {
    const one = pickChunk(rng, f.chunks.pods);
    return Array.from({ length: count }, () => one);
  }
  return Array.from({ length: count }, () => pickChunk(rng, f.chunks.pods));
}

/**
 * Assemble the hull: a straight corridor along x, pods on both sides, the bow chunk at its west end and the stern
 * (engine block) at its east end, plus bolted-on nubs. Returns null when chunks clash (the caller reseeds).
 */
export function buildSilhouette(rng: Rng, f: FactionDef, podsPerSide: number): Silhouette | null {
  const cv = new Canvas();
  const cw = rng.int(f.hull.corridorWidth[0], f.hull.corridorWidth[1]);
  const north = podRun(rng, f, podsPerSide);
  const mirrored = f.hull.symmetry !== 'none';
  const south = mirrored ? north : podRun(rng, f, Math.max(1, podsPerSide + rng.int(-1, 1)));
  // Lay out x positions first so the corridor can be stamped before the pods.
  const layout = (run: ChunkDef[]): { c: ChunkDef; x: number }[] => {
    let cursor = 0;
    return run.map((c, i) => {
      if (i > 0 && rng.chance(f.hull.gapChance)) cursor += 2;
      const at = { c, x: cursor };
      cursor += chunkWidth(c) - 1;
      return at;
    });
  };
  const nl = layout(north);
  const sl = mirrored ? nl : layout(south);
  const end = (l: { c: ChunkDef; x: number }[]): number => Math.max(...l.map((p) => p.x + chunkWidth(p.c) - 1));
  const xEnd = Math.max(end(nl), end(sl));
  const corridor = Array.from({ length: cw + 2 }, (_, j) =>
    Array.from({ length: xEnd + 1 }, (_, i) => (j === 0 || j === cw + 1 || i === 0 || i === xEnd ? '#' : 'h')).join(''));
  cv.stamp(corridor, 0, 0, 'hall');
  const pods: PodPlacement[] = [];
  for (const [side, l] of [['n', nl], ['s', sl]] as const) {
    l.forEach((p, i) => {
      const key = mirrored ? `pod.${i}.${side}` : `pod.${side}.${i}`;
      const placed = placePod(cv, p.c, side, p.x, side === 'n' ? 0 : cw + 1, key);
      if (placed) pods.push({ ...placed, index: i });
    });
  }
  if (pods.length < 2) return null;
  // Bow and stern: align their door block with the corridor rows (1..cw).
  const ends: PodPlacement[] = [];
  const attach = (chunks: readonly ChunkDef[], col: 'first' | 'last', key: string): boolean => {
    const fitting = chunks.filter((c) => doorRows(c, col).length === cw);
    const c = pickChunk(rng, fitting.length > 0 && mirrored ? fitting : chunks);
    const doors = doorRows(c, col);
    if (doors.length === 0 || doors.length > cw) return false;
    const y = 1 + rng.int(0, cw - doors.length) - (doors[0] as number);
    const x = col === 'last' ? -(chunkWidth(c) - 1) : xEnd;
    const frame = { index: 0, chunk: key, x, y, w: chunkWidth(c), h: c.rows.length };
    ends.push({ ...frame, side: 'n' }, { ...frame, side: 's', chunk: `${key}.s` });
    return cv.stamp(c.rows, x, y, key);
  };
  if (!attach(f.chunks.bows, 'last', 'bow') || !attach(f.chunks.sterns, 'first', 'stern')) return null;
  if (f.chunks.nubs.length > 0) {
    // Bolt-ons go on pods and, more rarely, on the bow and the engine block.
    for (const p of pods) if (rng.chance(f.hull.nubChance)) addNub(cv, rng, f, p, `nub.${p.chunk}`);
    for (const p of ends) if (rng.chance(f.hull.nubChance / 2)) addNub(cv, rng, f, p, `nub.${p.chunk}`);
  }
  cv.fixDoors();
  return { canvas: cv, pods, corridorWidth: cw };
}
