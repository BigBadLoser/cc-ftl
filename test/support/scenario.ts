import { deserialize, serialize } from '../../src/sim/save';
import type { ContentRegistry } from '../../src/sim/registry';
import { attachHooks, buildScenario, canonical, type BuildOpts, type Built } from '../../src/content/scenario';
import { content } from './content';

/**
 * Scenario access for tests (may import content, like `content.ts`). `scenario(name, opts)` builds a fresh scenario (use it for a test that is about the
 * build itself, or that needs state a save does not hold). `cachedScenario(name, opts)` builds it once per worker and returns an independent clone
 * (`cachedWorld`'s rules: a clone is what a save holds), with the hooks re-attached. The cache key is the name plus the canonical JSON of the seed, params
 * and overrides, so two different worlds can never share a key; overrides in a cached scenario must be plain data.
 */
export const scenario = (name: string, opts: Omit<BuildOpts, 'content'> = {}): Built => buildScenario(name, { ...opts, content });

const built = new Map<string, { json: string; content: ContentRegistry; hooks: Built['hookRefs']; rejected: Built['rejected']; requests: Built['requests'] }>();

export function cachedScenario(name: string, opts: Omit<BuildOpts, 'content' | 'sim'> = {}): Built {
  const key = `${name}:${canonical({ seed: opts.seed, params: opts.params, overrides: opts.overrides, extraHooks: opts.extraHooks })}`;
  let entry = built.get(key);
  if (!entry) {
    const b = scenario(name, opts);
    entry = { json: serialize(b.sim), content: b.sim.content, hooks: b.hookRefs, rejected: b.rejected, requests: b.requests };
    built.set(key, entry);
  }
  return attachHooks(deserialize(entry.json, entry.content), entry.hooks, false, { requests: [...entry.requests], rejected: { ...entry.rejected } });
}
