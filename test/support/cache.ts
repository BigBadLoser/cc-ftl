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

const SHARED = Symbol.for('cc-ftl.workerCaches');
const w = globalThis as unknown as { [SHARED]?: WeakMap<object, Map<string, Map<string, unknown>>> };

/**
 * A read-only cache that lasts the worker, not one file: for expensive pure builds many files make from the same inputs (a station
 * of a kind, size and seed). Entries are kept per `scope`, the content the builds read (the module defs object): an isolated file
 * imports its own content, which it may change, so it never shares entries with the shared files. `name` separates caches; at most
 * `max` entries stay per scope (the least recently used goes first), so the heap is bounded. Never mutate what it returns.
 */
export function workerCache<V>(name: string, max: number, scope: object): { get(key: string, make: () => V): V } {
  return {
    get(key, make) {
      const scopes = (w[SHARED] ??= new WeakMap());
      let all = scopes.get(scope);
      if (!all) scopes.set(scope, (all = new Map()));
      let m = all.get(name);
      if (!m) all.set(name, (m = new Map()));
      let v = m.get(key) as V | undefined;
      if (v !== undefined) m.delete(key);
      else v = make();
      m.set(key, v);
      if (m.size > max) m.delete(m.keys().next().value as string);
      return v;
    },
  };
}
