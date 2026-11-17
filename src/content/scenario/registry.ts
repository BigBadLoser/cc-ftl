import type { Hook, Part, Preset, ScenarioSpec } from './types';

/**
 * The registry: parts, presets and hooks are found by file glob (Vite resolves it in the browser build, Vitest and the profiler alike), so adding one is
 * adding a file. A part is `parts/<key>.ts`, a preset `presets/<name with / as .>.ts` and a hook `hooks/<name with / as .>.ts`, each the file's default export.
 */
const partFiles = import.meta.glob<{ default: Part }>(['./parts/*.ts', '!./parts/*.test.ts'], { eager: true });
const presetFiles = import.meta.glob<{ default: Preset }>(['./presets/**/*.ts', '!./presets/**/*.test.ts'], { eager: true });
const hookFiles = import.meta.glob<{ default: Hook }>(['./hooks/**/*.ts', '!./hooks/**/*.test.ts'], { eager: true });

/** `./presets/inspect/station.ts` -> `inspect.station`. */
const nameOf = (path: string, dir: string): string => path.replace(`./${dir}/`, '').replace(/\.ts$/, '').split('/').join('.');

function collect<T>(files: Record<string, { default: T }>, dir: string): Map<string, T> {
  const out = new Map<string, T>();
  for (const [path, mod] of Object.entries(files)) {
    const name = nameOf(path, dir);
    if (out.has(name)) throw new Error(`scenario ${dir}: duplicate name ${name}`);
    out.set(name, mod.default);
  }
  return out;
}

export const presets: ReadonlyMap<string, Preset> = collect(presetFiles, 'presets');
export const hooks: ReadonlyMap<string, Hook> = collect(hookFiles, 'hooks');

/** Parts in apply order (topological on `after`, ties by key so the order is stable). Throws on a duplicate key, an unknown `after` or a cycle. */
function orderParts(): Part[] {
  const byKey = new Map<string, Part>();
  for (const [path, mod] of Object.entries(partFiles)) {
    const p = mod.default;
    if (p.key !== nameOf(path, 'parts')) throw new Error(`scenario part ${path}: key "${String(p.key)}" must match the file name`);
    if (byKey.has(p.key)) throw new Error(`scenario parts: duplicate key ${String(p.key)}`);
    byKey.set(p.key, p);
  }
  const out: Part[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (key: string): void => {
    const s = state.get(key);
    if (s === 'done') return;
    if (s === 'visiting') throw new Error(`scenario parts: cycle through ${key}`);
    state.set(key, 'visiting');
    const p = byKey.get(key)!;
    for (const a of [...(p.after ?? [])].sort()) {
      if (!byKey.has(a)) throw new Error(`scenario part ${key}: unknown after "${a}"`);
      visit(a);
    }
    state.set(key, 'done');
    out.push(p);
  };
  for (const key of [...byKey.keys()].sort()) visit(key);
  return out;
}

export const parts: readonly Part[] = orderParts();
export const partKeys = (): string[] => parts.map((p) => p.key as string);

/** Every spec key must have a part: a key nothing applies would be silently ignored. */
export function checkSpec(spec: ScenarioSpec): void {
  const known = new Set(partKeys());
  for (const k of Object.keys(spec)) if (!known.has(k)) throw new Error(`scenario spec: no part for key "${k}"`);
}
