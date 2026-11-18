import type { BuildJob, BuildResult } from '../sim/stations/buildMemo';
import type { GenResult } from '../sim/shipgen/types';
import type { GenReply, GenRequest } from './genWorker';
import type { ShipGenerator } from './prewarm';

type Job = { job: 'ship'; shipgen: string; seed: number; depth: number } | { job: 'build'; build: BuildJob };

/** One genWorker.ts instance: posts jobs, resolves each with its reply. Rejects every job once the worker breaks. */
function lane(): ((job: Job) => Promise<GenReply>) | null {
  let worker: Worker;
  try {
    worker = new Worker(new URL('./genWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  let next = 1;
  const waiting = new Map<number, { ok: (r: GenReply) => void; fail: (e: unknown) => void }>();
  let broken: unknown = null;
  worker.onmessage = (e: MessageEvent<GenReply>) => {
    waiting.get(e.data.id)?.ok(e.data);
    waiting.delete(e.data.id);
  };
  worker.onerror = (e) => {
    broken = e ?? new Error('generator worker failed');
    for (const w of waiting.values()) w.fail(broken);
    waiting.clear();
  };
  return (job) =>
    new Promise((ok, fail) => {
      if (broken) return fail(broken);
      const id = next++;
      waiting.set(id, { ok, fail });
      worker.postMessage({ id, ...job } satisfies GenRequest);
    });
}

/**
 * A `ShipGenerator` on web workers (genWorker.ts), or null where workers are not available (the sim then warms ships and builds structures itself).
 * Ships and station builds run on separate workers: a build takes up to a second and a half, and a ship must not wait behind it.
 */
export function workerGenerator(): ShipGenerator | null {
  if (typeof Worker === 'undefined') return null;
  const ships = lane();
  if (!ships) return null;
  let builds: ReturnType<typeof lane> | undefined; // started on the first build, so a game that never travels does not load a second copy of the content
  return {
    generate: async (job): Promise<GenResult | null> => (await ships({ job: 'ship', ...job })).gen ?? null,
    build: async (job): Promise<BuildResult> => {
      if (builds === undefined) builds = lane();
      if (!builds) throw new Error('no build worker');
      const r = await builds({ job: 'build', build: job });
      if (r.failed || r.built === undefined) throw new Error('build failed');
      return r.built;
    },
  };
}
