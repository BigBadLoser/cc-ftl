const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * `base` with `over` laid on it: objects merge key by key, arrays and scalars replace, `null` deletes the key. Functions (a preset's `until`) are values.
 * Neither argument is changed.
 */
export function mergeSpec<T extends object>(base: T, over: object | undefined): T {
  if (!over) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    if (v === null) delete out[k];
    else if (v === undefined) continue;
    else if (isPlain(v) && isPlain(out[k])) out[k] = mergeSpec(out[k] as object, v);
    else out[k] = v;
  }
  return out as T;
}

/** Stable JSON of a value (sorted keys), the cache key of a scenario's name, params and overrides. Functions cannot be keyed and throw. */
export function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x) => {
    if (typeof x === 'function') throw new Error('scenario overrides in a cached scenario must be plain data (a function cannot be part of a cache key)');
    return isPlain(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x;
  });
}
