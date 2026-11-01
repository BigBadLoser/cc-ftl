import type { Atlas } from './assets/loader';

/** Tuning: how the scenes follow sheets that arrive (or are evicted) after they were built. */
export const REBUILD_MIN_MS = 1000;
/** A new ship stays hidden at most this long while its sheets load. */
export const FRESH_MS = 3000;
/** Env sheets are looked at for eviction at most this often, and only when the pool is over budget. */
export const CENSUS_MS = 8000;
/** When a look finds nothing to evict (everything is in use) the wait doubles, up to this. */
export const CENSUS_MAX_MS = 64000;

export interface ArtStreamHost {
  /** Drop every built scene so the next sync builds them again from the atlas (they re-ask for the art they use). */
  rebuild(): void;
  /** Build the scenes that are missing (after `rebuild`). */
  sync(): void;
}

export interface ArtStream {
  /** Once a frame, before drawing: rebuild scenes whose art arrived, and trim the env pool when it is over budget. */
  update(): void;
  /** Once a frame, after every view has updated (and so resolved its textures): finishes a census begun in `update`. */
  settle(): void;
  /** A new scene was just built: it stays hidden until the sheets it asked for are in (or `FRESH_MS` pass). A scene re-made by a rebuild keeps its state. */
  built(id: number): void;
  /** True while the scene is waiting for its sheets. */
  waiting(id: number): boolean;
  /** Scene rebuilds so far (debug). */
  rebuilds(): number;
}

/**
 * The renderer's side of lazy sheet loading. Built sprites hold the textures they were made with, so a scene built before
 * its sheets arrived is built again once they have (batched: when nothing is loading, or at most every `REBUILD_MIN_MS`
 * while loads trickle in). Memory is freed the same way: when the env pool is over budget, the scenes are rebuilt (which
 * marks the sheets they still use) and the sheets nothing used since are evicted. A rebuilt scene only resolves its
 * textures in its own `update`, so the sweep runs in `settle`, after the frame's views have asked for what they draw.
 */
export function createArtStream(atlas: Atlas, host: ArtStreamHost, now: () => number): ArtStream {
  let builtGen = atlas.generation;
  let lastRebuild = -Infinity;
  let lastCensus = now();
  let gap = CENSUS_MS;
  let count = 0;
  /** Use-clock mark of a census whose sweep waits for `settle`, or null. */
  let pending: number | null = null;
  const fresh = new Map<number, number>();
  /** True while our own rebuild re-creates scenes: those were already on screen, so they are never hidden again. */
  let rebuilding = false;

  const rebuild = (t: number): void => {
    rebuilding = true;
    try {
      host.rebuild();
      host.sync();
    } finally {
      rebuilding = false;
    }
    lastRebuild = t;
    count++;
  };

  return {
    update() {
      const t = now();
      for (const [id, deadline] of fresh) if (t > deadline) fresh.delete(id);
      const busy = atlas.busy();
      const stale = atlas.generation !== builtGen;
      if (stale && (busy === 0 || t - lastRebuild >= REBUILD_MIN_MS)) {
        builtGen = atlas.generation;
        rebuild(t);
      } else if (!stale && busy === 0) {
        fresh.clear();
        if (t - lastCensus >= gap && atlas.envOver()) {
          lastCensus = t;
          pending = atlas.mark();
          rebuild(t);
        }
      }
    },
    settle() {
      if (pending === null) return;
      const mark = pending;
      pending = null;
      gap = atlas.sweepEnv(mark).length ? CENSUS_MS : Math.min(CENSUS_MAX_MS, gap * 2);
      builtGen = atlas.generation;
    },
    built(id) {
      if (rebuilding) return;
      if (atlas.busy() > 0 && !fresh.has(id)) fresh.set(id, now() + FRESH_MS);
    },
    waiting: (id) => fresh.has(id),
    rebuilds: () => count,
  };
}
