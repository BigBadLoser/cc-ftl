/**
 * Test caches that last one test file. Most files share a worker with `isolate: false`, so a module-level `Map` would keep every
 * cached world of every file the worker runs until it ran out of heap (it did: a worker hit the V8 limit after the harness's caches
 * grew). `fileCache()` gives a Map that test/support/setup.ts empties after each file. Reuse across files was rare (keys are mostly
 * file-specific), so nothing measurable is lost.
 */
const REGISTRY = Symbol.for('cc-ftl.testCaches');
const g = globalThis as unknown as { [REGISTRY]?: Set<Map<unknown, unknown>> };
const caches = (g[REGISTRY] ??= new Set());

export function fileCache<K, V>(): Map<K, V> {
  const m = new Map<K, V>();
  caches.add(m as Map<unknown, unknown>);
  return m;
}

/** Empty every file cache (test/support/setup.ts calls it after each test file). */
export function clearFileCaches(): void {
  for (const m of caches) m.clear();
}
