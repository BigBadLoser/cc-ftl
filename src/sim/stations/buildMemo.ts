import { generateOutpost, type OutpostContent, type OutpostKind, type OutpostPlan, type OutpostStyle } from '../outposts/gen';
import type { StationResult } from '../shipgen/assembly/station';
import { buildStation } from '../shipgen/stationBuild';
import type { StationSize } from '../shipgen/stationTypes';
import type { Sim } from '../sim';

/**
 * Station and outpost builds made ahead (#538). `buildStation` takes 0.2 to 1.5 s and `generateOutpost` wraps it, so a node's first entry froze while
 * it built every structure. Both are pure functions of their job (kind, size and seed; outpost style, kind and seed) and the content, so a build can be
 * made somewhere else (the app's worker, during the hyperspace hop) and handed in here, per content registry like the ship memo (galaxy/arrivals.ts).
 * The sim builds a station or outpost only through `builtStation` / `builtOutpost`: the memo first, else on the spot. An entry is taken out when used
 * (stamping may edit it, and a structure is built once). Not saved: a cache.
 * - `claimBuild`: the claimer will make the job; `provideBuild` hands the result in, `releaseBuild` gives up (the worker failed).
 * - A job needed before its result arrives is built on the spot and its claim dropped, so the late copy is thrown away.
 */

export type BuildJob =
  | { type: 'station'; kind: string; size: StationSize; seed: number }
  | { type: 'outpost'; style: OutpostStyle; kind?: OutpostKind; seed: number };

/** What a job makes: a station (`buildStation` throws when no recipe stands, so a station is never null), or an outpost plan or null (none fits). */
export type BuildResult = StationResult | OutpostPlan | null;

/** Built jobs kept at once (a hub's result is a few hundred kB): the least recently provided goes first. */
export const BUILDS_MAX = 24;

export const buildKey = (j: BuildJob): string => (j.type === 'station' ? `station|${j.kind}|${j.size}|${j.seed >>> 0}` : `outpost|${j.style}|${j.kind ?? ''}|${j.seed}`);

/** Make a job, exactly as the sim does on a miss. Throws when a station has no recipe that stands; null for an unknown station kind. Used by the worker too. */
export function runBuild(job: BuildJob, content: OutpostContent): BuildResult {
  if (job.type === 'outpost') return generateOutpost(job.style, job.seed, content, job.kind);
  const def = content.stations[job.kind];
  return def ? buildStation(def, job.kind, job.size, job.seed >>> 0, content.modules) : null;
}

/** What `runBuild` reads, from a content registry (the sim's, or the worker's copy of the same content). */
export function buildContent(c: Sim['content']): OutpostContent {
  return { ores: Object.values(c.ores ?? {}) as OutpostContent['ores'], modules: c.modules, stations: c.stations ?? {} };
}

const memos = new WeakMap<object, Map<string, BuildResult>>();
const claimSets = new WeakMap<object, Set<string>>();
const memo = (sim: Sim): Map<string, BuildResult> => {
  let m = memos.get(sim.content);
  if (!m) memos.set(sim.content, (m = new Map()));
  return m;
};
const claims = (sim: Sim): Set<string> => {
  let s = claimSets.get(sim.content);
  if (!s) claimSets.set(sim.content, (s = new Set()));
  return s;
};

/** A replacement for the on-the-spot build in `built` (the test harness shares builds between files, `test/support/buildShare.ts`). Null in the game. */
type BuildRunner = (job: BuildJob, content: OutpostContent, registry: object) => BuildResult;
let runner: BuildRunner | null = null;
export const setBuildRunner = (r: BuildRunner | null): void => { runner = r; };

/** The job's result: taken from the memo, else made now (any claim on it is dropped, so a late result is not kept). Throws as `runBuild` does. */
function built(sim: Sim, job: BuildJob): BuildResult {
  const key = buildKey(job);
  const m = memo(sim);
  const r = m.get(key);
  if (r !== undefined) {
    m.delete(key);
    return r;
  }
  claims(sim).delete(key);
  return runner ? runner(job, buildContent(sim.content), sim.content) : runBuild(job, buildContent(sim.content));
}

/** A station of a kind and size from a seed: what `buildStation` gives. Throws when no recipe of the kind stands. */
export function builtStation(sim: Sim, kind: string, size: StationSize, seed: number): StationResult | null {
  return built(sim, { type: 'station', kind, size, seed }) as StationResult | null;
}

/** An outpost of a style (and kind, else rolled from the seed): what `generateOutpost` gives. */
export function builtOutpost(sim: Sim, style: OutpostStyle, seed: number, kind?: OutpostKind): OutpostPlan | null {
  return built(sim, { type: 'outpost', style, seed, ...(kind ? { kind } : {}) }) as OutpostPlan | null;
}

/** Is the job's result in the memo? */
export const isBuilt = (sim: Sim, job: BuildJob): boolean => memo(sim).has(buildKey(job));

/** Take on making a job elsewhere. False when it is already made or claimed, or names a station kind content lacks. */
export function claimBuild(sim: Sim, job: BuildJob): boolean {
  const key = buildKey(job);
  if (job.type === 'station' && !sim.content.stations?.[job.kind]) return false;
  if (memo(sim).has(key) || claims(sim).has(key)) return false;
  claims(sim).add(key);
  return true;
}

/** Hand in a claimed job's result (exactly what `runBuild` gives for it). Dropped when the claim is gone: the job was built on the spot meanwhile. */
export function provideBuild(sim: Sim, job: BuildJob, result: BuildResult): void {
  const key = buildKey(job);
  if (!claims(sim).delete(key)) return;
  const m = memo(sim);
  m.set(key, result);
  if (m.size > BUILDS_MAX) m.delete(m.keys().next().value as string);
}

/** Give up a claim (the maker failed): the sim builds the job itself when it is needed. */
export function releaseBuild(sim: Sim, job: BuildJob): void {
  claims(sim).delete(buildKey(job));
}
