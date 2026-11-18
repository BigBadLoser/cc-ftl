/**
 * Switch for the shared station and outpost builds (installed by `buildShareSetup.ts` in the shared project). No imports, so a helper may
 * use `withoutBuildShare` without loading the sim: `expectReplayable` builds twice and must really build twice.
 */
const KEY = Symbol.for('cc-ftl.sharedBuilds');
const g = globalThis as unknown as { [KEY]?: { memos: WeakMap<object, Map<string, unknown>>; off: number } };
export const buildShareState = (g[KEY] ??= { memos: new WeakMap(), off: 0 });

export function withoutBuildShare<T>(fn: () => T): T {
  buildShareState.off++;
  try { return fn(); } finally { buildShareState.off--; }
}
