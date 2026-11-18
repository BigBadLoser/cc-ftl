import { buildKey, runBuild, setBuildRunner, type BuildJob, type BuildResult } from '../../src/sim/stations/buildMemo';
import { buildShareState as state } from './buildShare';

/**
 * Vitest setup file (shared project only, vite.config.ts): station and outpost builds the sim makes on the spot (`builtStation`,
 * `builtOutpost`) are kept per content registry across test files, so the dozens of tests that generate the same hub, outpost
 * or station (kind, size, seed) pay for it once per worker. A build is a pure function of its job and the content, and the sim edits what
 * it is handed (stamping), so every call returns a `structuredClone` of the kept result. Direct calls of `buildStation` and
 * `generateOutpost` (the tests about the generator itself) never go through here; `withoutBuildShare` (buildShare.ts) turns it off.
 */
const memos = state.memos as WeakMap<object, Map<string, BuildResult>>;
/** Kept builds per content registry: a hub is a few hundred kB, so a worker's heap stays bounded. */
const KEEP = 40;

setBuildRunner((job: BuildJob, content, registry) => {
  if (state.off > 0) return runBuild(job, content);
  let m = memos.get(registry);
  if (!m) memos.set(registry, (m = new Map()));
  const key = buildKey(job);
  let r = m.get(key);
  if (r !== undefined) m.delete(key);
  else r = runBuild(job, content); // a build that throws is not kept
  m.set(key, r); // most recently used last
  if (m.size > KEEP) m.delete(m.keys().next().value as string);
  return r === null ? null : structuredClone(r);
});
