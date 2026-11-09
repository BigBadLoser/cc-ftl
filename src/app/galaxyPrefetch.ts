import { chunkOfId, galaxyGen, type ChunkData, type Sim } from '../sim';
import type { ChunkRequest } from './chunkWorker';
import { provideOutlines, warmOutlines } from './starmapClusters';

/** Chunks generated ahead of the player: this many rings around their chunk (the sim itself needs FRONTIER_RING = 1). */
export const PREFETCH_RING = 2;
/** Normally one chunk every PREFETCH_EVERY bridge updates; for PREFETCH_BOOST_MS after a jump (while the starmap
 * slides the ship along the lane) as many as fit in PREFETCH_BOOST_BUDGET_MS per update. */
export const PREFETCH_EVERY = 4;
export const PREFETCH_BOOST_MS = 1600;
export const PREFETCH_BOOST_BUDGET_MS = 10;

/** Builds chunks somewhere that does not stall the frame. `request` resolves with the chunk and its outlines; null when it cannot. */
export interface ChunkBuilder {
  request(job: { seed: number; cx: number; cy: number }): Promise<{ chunk: ChunkData | null; outlines: [string, string][] }>;
}

let builder: ChunkBuilder | null | undefined;
/** Chunks asked of the builder and not in yet, by `<seed>:<cx>,<cy>`. */
const pending = new Set<string>();

/** Use `b` to build chunks (null: build them here, on the main thread). Tests and the first call set it; a failed job turns it off. */
export function setChunkBuilder(b: ChunkBuilder | null): void {
  builder = b;
  pending.clear();
}

/**
 * Generate ahead: the galaxy is a pure function of (seed, chunk), so chunks around the player can be built early into
 * the generator's cache, with their sector outlines. When a jump then needs them they are ready, and the jump does not
 * hitch. Nothing in the sim's state changes. Each call takes on at most one chunk, nearest first; returns whether it did. `warm`:
 * also compute the chunk's sector outlines (only once the starmap has been built). With a worker (`workerChunks`) the chunk and its
 * outlines are built there and handed in when they arrive (a chunk costs up to tens of ms, outlines up to ten more: a hitch here);
 * a chunk the sim needs first is built on the spot as ever, and the late copy is dropped.
 */
export function prefetchGalaxy(sim: Sim, warm: boolean, ring = PREFETCH_RING): boolean {
  const key = chunkOfId(sim.galaxy.current);
  if (!key) return false;
  const [cx, cy] = key.split(',').map(Number) as [number, number];
  const gen = galaxyGen(sim.seed, sim.content.galaxy);
  if (builder === undefined) builder = workerChunks();
  for (let r = 0; r <= ring; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || gen.hasChunk(cx + dx, cy + dy)) continue;
        const b = builder;
        if (!b) {
          const chunk = gen.chunk(cx + dx, cy + dy);
          if (warm) warmOutlines(chunk);
          return true;
        }
        const job = { seed: sim.seed, cx: cx + dx, cy: cy + dy };
        const id = `${job.seed}:${job.cx},${job.cy}`;
        if (pending.has(id)) continue;
        pending.add(id);
        b.request(job).then(
          (res) => {
            pending.delete(id);
            if (res.chunk) gen.provideChunk(res.chunk);
            provideOutlines(res.outlines);
          },
          () => {
            pending.delete(id);
            if (builder === b) builder = null; // the worker is gone: build here again
          },
        );
        return true;
      }
    }
  }
  return false;
}

/** A `ChunkBuilder` on a web worker (chunkWorker.ts), or null where workers are not available. */
function workerChunks(): ChunkBuilder | null {
  if (typeof Worker === 'undefined') return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./chunkWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  let next = 1;
  const waiting = new Map<number, { ok: (r: { chunk: ChunkData | null; outlines: [string, string][] }) => void; fail: (e: unknown) => void }>();
  let broken: unknown = null;
  worker.onmessage = (e: MessageEvent<{ id: number; chunk: ChunkData | null; outlines: [string, string][] }>) => {
    waiting.get(e.data.id)?.ok(e.data);
    waiting.delete(e.data.id);
  };
  worker.onerror = (e) => {
    broken = e ?? new Error('chunk worker failed');
    for (const w of waiting.values()) w.fail(broken);
    waiting.clear();
  };
  return {
    request: (job) =>
      new Promise((ok, fail) => {
        if (broken) return fail(broken);
        const id = next++;
        waiting.set(id, { ok, fail });
        worker.postMessage({ id, ...job } satisfies ChunkRequest);
      }),
  };
}
